import { Router } from "express";
import ReviewQueueItem from "../models/ReviewQueueItem.js";
import { generateDraftAnswer } from "../services/answers.js";
import { ingestGoldenAnswer } from "../ingest-logic.js";
import { getVectorStore, pruneKeyHealth, userKeyHealth } from "../clients.js";
import {
    findInstantAnswer,
    normalizeQuestion,
    SERVABLE_RATINGS,
} from "../services/retrieval.js";

const router = Router();

// Key-health lookup for the backend's funding decisions. The backend sends
// sha256 hex of the decrypted key (never the key) and gets back whether
// this service would actually attempt it right now.
router.get('/user-key-health', async (req, res) => {
    try {
        const { hash } = req.query;
        if (!hash || typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) {
            return res.status(400).json({ error: "hash (sha256 hex) is required." });
        }
        pruneKeyHealth();
        const entry = userKeyHealth.get(hash.toLowerCase());
        if (!entry) return res.json({ status: 'ok', until: null });
        res.json({ status: entry.status, until: entry.until });
    } catch (error) {
        console.error("Error checking key health:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// 4. TA Review Queue
// A draft answer sits here in "pending" status until a TA approves or
// rejects it. Students can never read draft/pending content — only an
// approved final answer, fetched through /my-answer/:id. Persisted in
// MongoDB via ReviewQueueItem so it survives restarts/deploys.

// 5. Student-facing: submit a question.
// Responds as soon as the question is saved — generation runs afterward
// and fills in draftAnswer once it's done. The student was always waiting
// on nothing they could see (drafts never reach them unapproved), so there
// was no reason to block the response on the LLM call.

router.post('/submit-question', async (req, res) => {
    try {
        // user_key is the asker's own Gemini key (BYOK), passed through by
        // the backend after decrypting. Per-call only: used for this
        // question's funding ladder, never stored, never logged.
        const { student_id, question, module_id, course_id, thread_id, user_key } = req.body;

        if (!question) return res.status(400).json({ error: "Question is required." });

        const scope = { courseId: course_id ?? null, moduleId: module_id ?? null };

        // Instant-answer fast path — best-effort wrapper: ANY failure here
        // must fall through to the normal queue, never fail the submission.
        let source = null;
        try {
            source = await findInstantAnswer(question, scope);
        } catch (err) {
            console.error("Instant-answer fast path failed, queueing normally:", err.message);
        }

        if (source) {
            // A per-student approved record (so their history/stats read
            // naturally), answered from the verified source. Never touches
            // the TA queue and never re-ingests as golden (that would
            // clone golden-of-golden forever).
            const item = await ReviewQueueItem.create({
                studentId: student_id ?? null,
                moduleId: scope.moduleId,
                courseId: scope.courseId,
                question,
                normalizedQuestion: normalizeQuestion(question) || null,
                draftAnswer: source.finalAnswer || "",
                finalAnswer: source.finalAnswer,
                citations: source.citations || [],
                rating: source.rating ?? null,
                status: 'approved',
                autoServed: true,
                servedFrom: source._id.toString(),
            });
            return res.json({
                status: "success",
                message: "Answered instantly from a verified answer.",
                request_id: item._id.toString(),
                autoServed: true,
                // Show-the-match transparency: the student sees WHICH
                // verified question answered them, instead of a silent
                // substitution. Also builds the feedback signal (a wrong
                // match here is a re-ask, which tunes the threshold).
                matchedQuestion: source.question,
            });
        }

        // Follow-ups skip the TA queue entirely: the answer generates
        // synchronously (awaited — the student waits seconds, not hours)
        // and serves approved straight away. Unreviewed answers never
        // teach the pipeline, so no golden ingest happens for these.
        // Generation failure falls back to the normal queue below.
        if (thread_id) {
            const item = await ReviewQueueItem.create({
                studentId: student_id ?? null,
                moduleId: scope.moduleId,
                courseId: scope.courseId,
                question,
                normalizedQuestion: normalizeQuestion(question) || null,
                threadId: thread_id,
            });
            const generated = await generateDraftAnswer(item, { direct: true, chatApiKey: user_key ?? null });
            if (generated) {
                item.status = 'approved';
                item.finalAnswer = generated.draftAnswer;
                await item.save();
                return res.json({
                    status: "success",
                    message: "Answered.",
                    request_id: item._id.toString(),
                    threadAnswered: true,
                    answer: item.finalAnswer,
                    fundedBy: generated.fundedBy,
                    userKeyStatus: generated.userKeyStatus,
                });
            }
            // Generation failed — item stays pending below for TA review.
            res.json({
                status: "success",
                message: "Question received. Your answer is being reviewed by a TA.",
                request_id: item._id.toString(),
                threadAnswered: false,
            });
            return;
        }

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
            moduleId: scope.moduleId,
            courseId: scope.courseId,
            question,
            normalizedQuestion: normalizeQuestion(question) || null,
            threadId: thread_id ?? null,
        });

        res.json({
            status: "success",
            message: "Question received. Your answer is being reviewed by a TA.",
            request_id: item._id.toString(),
            autoServed: false,
        });

        // Fire-and-forget: not awaited, runs after the response is sent.
        // Funding outcome lands nowhere observable here by design — the
        // backend meters on supply (key included ⇒ attempt made) and the
        // rag-side health map short-circuits repeat failures.
        generateDraftAnswer(item, { chatApiKey: user_key ?? null });

    } catch (error) {
        console.error("Error processing question:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

// 6. TA-facing: list everything still awaiting review.
// Excludes items whose draft is still being generated — an empty
// draftAnswer means generateDraftAnswer hasn't finished (or failed) yet,
// and there's nothing for a TA to approve/edit/reject in the meantime.
router.get('/review-queue', async (req, res) => {
    // ALL pending items, including draftless ones whose generation failed
    // — those render with their error + a Retry action instead of rotting
    // invisibly (the old draftAnswer filter hid them forever).
    const filter = { status: 'pending' };
    // Optional course scoping (?courseId=...) so callers can pull one
    // course's queue without sifting the whole platform's. Absent = all
    // pending, preserving the old behavior for existing callers.
    if (req.query.courseId) filter.courseId = req.query.courseId;
    const pending = await ReviewQueueItem.find(filter)
        .sort({ createdAt: 1 })
        .lean();
    res.json(pending);
});

// Retries generation for a stuck pending item (empty draft after a
// failed attempt). Fire-and-forget like the original submit path — the
// TA sees the fresh draft on next queue refresh.
router.post('/review-queue/:id/retry', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.status !== 'pending') {
        return res.status(400).json({ error: "Only pending items can be retried." });
    }
    item.generationError = null;
    await item.save();
    generateDraftAnswer(item, { chatApiKey: null });
    res.json({ status: 'retrying', id: item._id.toString() });
});

// Purges every Q&A history item tied to any of the given modules. Called
// by the backend when a course is hard-deleted, so a course's questions
// and drafts don't outlive the course itself in this service's own
// MongoDB collection.
router.post('/review-queue/purge', async (req, res) => {
    try {
        const { moduleIds } = req.body;
        if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
            return res.status(400).json({ error: "moduleIds (non-empty array) is required." });
        }
        const result = await ReviewQueueItem.deleteMany({ moduleId: { $in: moduleIds } });
        res.json({ deleted: result.deletedCount });
    } catch (error) {
        console.error("Error purging review queue:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Purges one member's Q&A history within the given modules. Called by the
// backend when a student/TA is removed from a course — unlike /purge above
// (which wipes a whole course), this is scoped to a single studentId so
// everyone else's history survives.
router.post('/review-queue/purge-member', async (req, res) => {
    try {
        const { studentId, moduleIds } = req.body;
        if (!studentId || !Array.isArray(moduleIds) || moduleIds.length === 0) {
            return res.status(400).json({ error: "studentId and moduleIds (non-empty array) are required." });
        }
        const result = await ReviewQueueItem.deleteMany({ studentId, moduleId: { $in: moduleIds } });
        res.json({ deleted: result.deletedCount });
    } catch (error) {
        console.error("Error purging member history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Full history for one module, any status — powers the TA "History"
// view, where a TA picks a specific module and wants to see everything
// ever asked in it (pending, approved, and rejected alike), not just
// what's still awaiting review.
router.get('/module-history/:moduleId', async (req, res) => {
    const items = await ReviewQueueItem.find({ moduleId: req.params.moduleId })
        .sort({ createdAt: -1 })
        .lean();
    res.json(items);
});

// Normalizes the TA star rating: absent/blank stays null ("unattended —
// mark nothing"), otherwise it must be an integer 1–5.
function normalizeRating(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error("rating must be an integer from 1 to 5, or left empty");
    }
    return n;
}

// Minimum rating that still teaches the pipeline. Unrated approvals count
// as endorsements (the TA approved it, just didn't score it); 1–2 star
// answers are kept out of the knowledge base so poor drafts can't
// self-perpetuate.
const GOLDEN_MIN_RATING = 3;

// Distinct-TA important marks needed before a question is highlighted to
// the instructor. Low on purpose: most courses have a handful of TAs, so
// 2 means "more than one TA independently flagged this".
const IMPORTANT_THRESHOLD = 2;


// 7. TA-facing: approve a draft, optionally editing it and/or rating it
// before it goes out. Approving feeds the final answer back into the
// vector store as a golden chunk (see ingestGoldenAnswer) — the feedback
// loop that lets reviewed answers improve future drafts.
router.post('/review-queue/:id/approve', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    let rating;
    try {
        rating = normalizeRating(req.body?.rating);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const editedAnswer = req.body?.editedAnswer;
    item.status = 'approved';
    item.finalAnswer = editedAnswer || item.draftAnswer;
    item.wasEdited = editedAnswer !== undefined && editedAnswer !== null && String(editedAnswer).trim() !== "";
    item.rating = rating;
    item.reviewedBy = req.body?.reviewedBy ?? null;
    item.reviewedAt = new Date();
    await item.save();

    // Feedback loop — best-effort by design: a down vector DB must never
    // fail the approval itself, worst case this answer just doesn't teach
    // future drafts until re-approved.
    let goldenIngested = false;
    if (rating === null || rating >= GOLDEN_MIN_RATING) {
        try {
            const result = await ingestGoldenAnswer({
                question: item.question,
                answer: item.finalAnswer,
                reviewId: item._id.toString(),
                moduleId: item.moduleId,
                courseId: item.courseId,
                rating,
            });
            goldenIngested = !result.skipped;
        } catch (err) {
            console.error(`Golden ingest failed for review ${item._id}:`, err.message);
        }
    }

    res.json({ status: 'approved', id: item._id.toString(), rating, goldenIngested, studentId: item.studentId, question: item.question });
});

// 8. TA-facing: reject a draft (e.g. hallucinated or off-topic).
router.post('/review-queue/:id/reject', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    item.status = 'rejected';
    item.finalAnswer = req.body?.note || "A TA reviewed this question and could not provide an answer from the course materials.";
    item.reviewedBy = req.body?.reviewedBy ?? null;
    item.reviewedAt = new Date();
    await item.save();
    res.json({ status: 'rejected', id: item._id.toString() });
});

// Toggles one TA's important mark on a question (checkbox semantics).
// Returns the new state plus whether the threshold is now met.
router.post('/review-queue/:id/important', async (req, res) => {
    const { taId } = req.body ?? {};
    if (!taId) return res.status(400).json({ error: "taId is required." });

    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const marks = new Set(item.importantBy || []);
    const important = !marks.has(taId);
    if (important) marks.add(taId);
    else marks.delete(taId);
    item.importantBy = [...marks];
    await item.save();

    const importantCount = item.importantBy.length;
    res.json({
        important,
        importantCount,
        highlighted: importantCount >= IMPORTANT_THRESHOLD,
        threshold: IMPORTANT_THRESHOLD,
    });
});

// Minimum cosine similarity for a "related" suggestion. Question-to-
// question matches score high; anything below this is noise wearing a
// trenchcoat — previously unfiltered, hence the unrelated suggestions.
const RELATED_MIN_SIMILARITY = 0.6;

// Live "related answers" for the ask form: top golden matches in scope
// with their verified answers attached, so students often find their
// answer without submitting. Approved + servable-rated only — drafts and
// quarantined (1–2★) answers never surface here.
router.get('/related-questions', async (req, res) => {
    try {
        const { q, courseId, moduleId, limit } = req.query;
        if (!q || q.trim().length < 3) return res.json([]);

        const k = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
        const must = [{ key: "metadata.golden", match: { value: true } }];
        if (courseId) must.push({ key: "metadata.courseId", match: { value: courseId } });
        if (moduleId) must.push({ key: "metadata.moduleId", match: { value: moduleId } });

        const scored = await getVectorStore().similaritySearchWithScore(q, k * 2, { must });

        // Several chunks can belong to one answer — keep each answer once,
        // at its best score. Question chunks (strong signal) outrank
        // answer chunks before the floor applies, so a great paraphrase
        // never loses to a mediocre answer-text overlap.
        const bestByReview = new Map();
        for (const [doc, score] of scored) {
            if (score < RELATED_MIN_SIMILARITY) continue;
            const documentId = String(doc.metadata?.documentId ?? '');
            if (!documentId.startsWith('golden:')) continue;
            const reviewId = documentId.slice('golden:'.length);
            const boost = doc.metadata?.questionChunk === true ? 0.05 : 0;
            const ranked = Math.min(1, score + boost);
            if (!bestByReview.has(reviewId) || bestByReview.get(reviewId) < ranked) {
                bestByReview.set(reviewId, ranked);
            }
        }
        if (bestByReview.size === 0) return res.json([]);

        const items = await ReviewQueueItem.find({
            _id: { $in: [...bestByReview.keys()] },
            status: 'approved',
        }).lean();

        res.json(
            items
                .filter((item) => SERVABLE_RATINGS(item.rating))
                .map((item) => ({
                    id: item._id.toString(),
                    question: item.question,
                    // Full verified text (bounded) — the ask form
                    // truncates with a "Read more" expander client-side.
                    answer: String(item.finalAnswer || '').slice(0, 2000),
                    rating: item.rating ?? null,
                    score: bestByReview.get(item._id.toString()),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, k)
        );
    } catch (error) {
        console.error("Error fetching related questions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Save a verified answer into another student's history: the asker saw
// their exact question in "related" while typing and takes the verified
// answer as-is. No generation, no review — the source was already
// TA-approved. Scope must match (same course + module), rating must be
// servable; anything else 4xxs. The clone is marked autoServed so it
// reads naturally in history/stats without ever touching the queue.
router.post('/save-answer', async (req, res) => {
    try {
        const { student_id, source_id, module_id, course_id } = req.body;
        if (!source_id) return res.status(400).json({ error: "source_id is required." });

        const source = await ReviewQueueItem.findById(source_id).lean();
        if (!source) return res.status(404).json({ error: "Source answer not found." });
        if (source.status !== 'approved') {
            return res.status(400).json({ error: "Only approved answers can be saved." });
        }
        if (!SERVABLE_RATINGS(source.rating)) {
            return res.status(400).json({ error: "That answer is not servable." });
        }
        if ((source.moduleId ?? null) !== (module_id ?? null) ||
            (source.courseId ?? null) !== (course_id ?? null)) {
            return res.status(400).json({ error: "Source answer is from a different scope." });
        }

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
            moduleId: source.moduleId,
            courseId: source.courseId,
            question: source.question,
            normalizedQuestion: source.normalizedQuestion || normalizeQuestion(source.question) || null,
            draftAnswer: source.finalAnswer || "",
            finalAnswer: source.finalAnswer,
            citations: source.citations || [],
            rating: source.rating ?? null,
            wasEdited: source.wasEdited ?? false,
            status: 'approved',
            autoServed: true,
            servedFrom: source._id.toString(),
        });
        res.json({
            status: "success",
            message: "Answer saved to your history.",
            request_id: item._id.toString(),
        });
    } catch (error) {
        console.error("Error saving answer:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

// Removes a saved/instant clone from a student's own history. Only the
// owning student, only auto-served clones — reviewed answers are never
// deletable through here (TA History is the record for those).
router.post('/unsave-answer', async (req, res) => {
    try {
        const { student_id, request_id } = req.body;
        if (!request_id) return res.status(400).json({ error: "request_id is required." });

        const item = await ReviewQueueItem.findById(request_id);
        if (!item) return res.status(404).json({ error: "Not found." });
        if (item.studentId !== (student_id ?? null) || !item.autoServed) {
            return res.status(403).json({ error: "Only your own saved answers can be removed." });
        }
        await ReviewQueueItem.deleteOne({ _id: request_id });
        res.json({ status: "success", removed: true });
    } catch (error) {
        console.error("Error removing saved answer:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

// Questions highlighted to the instructor: non-rejected items in a course
// with at least IMPORTANT_THRESHOLD distinct-TA marks, hottest first.
// "Just the questions" — the instructor portal renders question text +
// mark counts, nothing else from these rows is needed... except moduleId
// so it can label which module each came from.
router.get('/review-queue/important', async (req, res) => {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ error: "courseId query param is required." });

    const items = await ReviewQueueItem.find({
        courseId,
        status: { $ne: 'rejected' },
    }).lean();

    res.json(
        items
            .map((item) => ({
                id: item._id.toString(),
                moduleId: item.moduleId,
                question: item.question,
                status: item.status,
                importantCount: (item.importantBy || []).length,
                createdAt: item.createdAt,
            }))
            .filter((item) => item.importantCount >= IMPORTANT_THRESHOLD)
            .sort((a, b) => b.importantCount - a.importantCount)
    );
});

// Per-course activity counts: questions asked per student, reviews
// resolved per TA (approvals + rejections where the resolver is known).
router.get('/review-queue/course-stats', async (req, res) => {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ error: "courseId query param is required." });

    const items = await ReviewQueueItem.find({ courseId }).lean();

    const asked = {};
    const reviewed = {};
    // Quality rollups for the instructor's answer-quality view.
    let ratingSum = 0;
    let ratedCount = 0;
    let editedCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let resolutionMsSum = 0;
    let resolutionCount = 0;
    for (const item of items) {
        if (item.studentId) asked[item.studentId] = (asked[item.studentId] || 0) + 1;
        if (item.status === 'pending') {
            pendingCount += 1;
            continue;
        }
        if (item.reviewedBy) reviewed[item.reviewedBy] = (reviewed[item.reviewedBy] || 0) + 1;
        if (item.status === 'approved') {
            approvedCount += 1;
            if (item.wasEdited) editedCount += 1;
            if (item.rating !== null && item.rating !== undefined) {
                ratingSum += item.rating;
                ratedCount += 1;
            }
        } else if (item.status === 'rejected') {
            rejectedCount += 1;
        }
        if (item.reviewedAt && item.createdAt) {
            resolutionMsSum += new Date(item.reviewedAt) - new Date(item.createdAt);
            resolutionCount += 1;
        }
    }

    // Content gaps: per-module abstention counts. Every "I don't know."
    // is a student asking about something the material doesn't cover —
    // aggregated, that's the instructor's curriculum radar.
    const gaps = {};
    for (const item of items) {
        if (!item.moduleId) continue;
        const entry = gaps[item.moduleId] || (gaps[item.moduleId] = { asked: 0, unanswered: 0 });
        entry.asked += 1;
        if ((item.draftAnswer || '').trim() === "I don't know.") entry.unanswered += 1;
    }

    res.json({
        asked: Object.entries(asked).map(([studentId, count]) => ({ studentId, count })),
        reviewed: Object.entries(reviewed).map(([taId, count]) => ({ taId, count })),
        gaps: Object.entries(gaps)
            .map(([moduleId, counts]) => ({ moduleId, ...counts }))
            .filter((g) => g.unanswered > 0)
            .sort((a, b) => b.unanswered - a.unanswered),
        quality: {
            avgRating: ratedCount > 0 ? +(ratingSum / ratedCount).toFixed(1) : null,
            ratedCount,
            editedCount,
            approvedCount,
            rejectedCount,
            pendingCount,
            avgResolutionHours: resolutionCount > 0 ? +((resolutionMsSum / resolutionCount) / 3600000).toFixed(1) : null,
        },
    });
});

// 9. Student-facing: check on / retrieve a submitted question.
// Returns only status while pending; the answer is included only once approved.
router.get('/my-answer/:id', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    if (item.status === 'pending') {
        return res.json({ status: 'pending', message: "Your answer is still being reviewed by a TA." });
    }

    res.json({ status: item.status, answer: item.finalAnswer, rating: item.rating ?? null, citations: item.citations ?? [] });
});

// 10. Student-facing: list everything a given student has ever asked.
// Was previously called by the backend but never implemented here.
// Thread (chatbot) items are excluded by default — the History page shows
// only fresh questions + TA-reviewed answers, while threads live in the
// chatbot. Pass ?includeThreads=1 for the full set (thread view, stats).
router.get('/my-answers/:studentId', async (req, res) => {
    const filter = { studentId: req.params.studentId };
    if (req.query.includeThreads !== '1') {
        filter.threadId = null;
    }
    const items = await ReviewQueueItem.find(filter)
        .sort({ createdAt: -1 })
        .lean();

    res.json(
        items.map((item) => ({
            id: item._id.toString(),
            moduleId: item.moduleId,
            courseId: item.courseId ?? null,
            question: item.question,
            status: item.status,
            answer: item.status === 'pending' ? null : item.finalAnswer,
            rating: item.rating ?? null,
            wasEdited: item.wasEdited ?? false,
            citations: item.citations ?? [],
            threadId: item.threadId ?? null,
            createdAt: item.createdAt,
        }))
    );
});

// 11. Student-facing: quick counts of how their questions have fared.
// Was previously called by the backend but never implemented here.
router.get('/stats/:studentId', async (req, res) => {
    const { studentId } = req.params;

    const [total, pending, approved, rejected] = await Promise.all([
        ReviewQueueItem.countDocuments({ studentId }),
        ReviewQueueItem.countDocuments({ studentId, status: 'pending' }),
        ReviewQueueItem.countDocuments({ studentId, status: 'approved' }),
        ReviewQueueItem.countDocuments({ studentId, status: 'rejected' }),
    ]);

    res.json({ total, pending, approved, rejected });
});

export default router;
