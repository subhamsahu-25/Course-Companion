import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// Gemini AI modules (swapped from local Ollama — free hosted API, no local
// model process to keep running once this service is deployed)
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Connection to the managed vector database (Qdrant Cloud free tier)
import { QdrantVectorStore } from "@langchain/qdrant";
import {
    getQdrantClient,
    getCollectionName,
    ensureQdrantCollection,
} from "./qdrant.js";

// Ingestion — turns an uploaded file into chunks in the vector store.
import {
    ingestSingleDocument,
    ingestGoldenAnswer,
    removeDocumentChunks,
    removeScopeChunks,
    scopeFilter,
} from "./ingest-logic.js";

const app = express();
// Raised from the default 100kb limit: the backend sends uploaded files
// here as base64 JSON, which needs headroom for anything near the 50MB
// upload cap the backend enforces.
app.use(express.json({ limit: "65mb" }));

// Public liveness probe for uptime monitors (cron-job.org etc.) —
// everything else on this service sits behind the service-key gate,
// so monitors need one ungated URL that answers 200 when alive.
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "rag" });
});

// 0. Service-to-service auth.
// This service exposes internal endpoints (approve/reject a TA review, read
// any student's answers) that should only ever be called by the main
// backend, never hit directly by a browser. RAG_SERVICE_KEY is a shared
// secret configured identically here and in backend/.env.
const REQUIRED_SERVICE_KEY = process.env.RAG_SERVICE_KEY;
app.use((req, res, next) => {
    if (!REQUIRED_SERVICE_KEY) {
        // Fail loud in every environment rather than silently running open —
        // an unset key is a misconfiguration, not "no auth needed".
        console.error("RAG_SERVICE_KEY is not set — refusing all requests.");
        return res.status(500).json({ error: "Service is misconfigured" });
    }
    if (req.header("x-service-key") !== REQUIRED_SERVICE_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

// 0.5 Connect to MongoDB — same cluster/DB the main backend uses, so this
// service's data lives alongside the rest of the app's data instead of
// disappearing on every restart like the old in-memory Map did.
await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
console.log("✅ RAG service connected to MongoDB");

const reviewQueueItemSchema = new mongoose.Schema(
    {
        studentId: { type: String, default: null },
        // Persisted so history can be scoped per course/module later —
        // previously this only lived transiently in the request body used
        // for retrieval filtering, so /my-answers had no way to tell which
        // module a given question was even about.
        moduleId: { type: String, default: null, index: true },
        // Course scope, stored alongside moduleId so retrieval, history,
        // and purge can all be isolated per course — moduleIds alone can't
        // do that (two courses can hold same-titled modules, and module
        // lookups live in the backend, not here).
        courseId: { type: String, default: null, index: true },
        question: { type: String, required: true },
        // Starts empty and is filled in once generation finishes (see
        // /submit-question below) — the student no longer waits on the LLM
        // call, so a record can briefly exist with no draft yet.
        draftAnswer: { type: String, default: "" },
        sources: { type: [String], default: [] },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            index: true,
        },
        finalAnswer: { type: String, default: null },
        // TA star rating, 1 (very poor) to 5 (very good). Null means the TA
        // left it unattended — deliberately NOT defaulted to 0, so
        // "unrated" stays distinguishable from "rated poorly".
        rating: { type: Number, default: null, min: 1, max: 5 },
        // True when the TA edited the draft before approving — lets the
        // feedback loop (and future analytics) tell "approved as-is" apart
        // from "approved with corrections".
        wasEdited: { type: Boolean, default: false },
        // Traceable citations: the actual documents placed in the LLM's
        // context for this question (source file, page, line range), NOT
        // the model's self-reported SOURCES line. Powers the "which PDF,
        // which page, which line" tags in history views.
        citations: {
            type: [
                {
                    source: { type: String, default: "Unknown source" },
                    page: { type: Number, default: null },
                    line: { type: Number, default: null },
                    lineEnd: { type: Number, default: null },
                    golden: { type: Boolean, default: false },
                },
            ],
            default: [],
        },
    },
    { timestamps: true }
);
reviewQueueItemSchema.index({ studentId: 1, createdAt: -1 });

const ReviewQueueItem = mongoose.model("ReviewQueueItem", reviewQueueItemSchema);

// 1. Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set — refusing to start.");
    process.exit(1);
}

const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: GEMINI_API_KEY,
    // text-embedding-004 was shut down by Google on Jan 14, 2026 (that's
    // the 404 you may have seen). gemini-embedding-001 is the current
    // replacement — note it outputs 3072-dim vectors instead of 768, so
    // this MUST match whatever ingest-logic.js uses too, or retrieval
    // breaks silently.
    model: "gemini-embedding-001",
});

const llm = new ChatGoogleGenerativeAI({
   apiKey: GEMINI_API_KEY,
   // Upgraded from gemini-3.1-flash-lite (cost-optimized workhorse) for
   // draft quality: 3.6 Flash follows the stay-close-to-source prompt far
   // more faithfully and keeps concrete details instead of compressing
   // them into generic statements. Verified to exist (DeepMind model card,
   // July 2026). Temperature stays 0 — determinism matters more than
   // creativity for grounded answers.
   model: "gemini-3.6-flash",
   temperature: 0,
});

// 2. Connect to the existing vector collection.
// Qdrant Cloud persists the vectors server-side, so unlike the old
// self-hosted Chroma this service is fully stateless — local disk being
// wiped on every restart/redeploy (Cloud Run / Render free) loses nothing.
const qdrantClient = getQdrantClient();
const COLLECTION_NAME = getCollectionName();
await ensureQdrantCollection(qdrantClient, COLLECTION_NAME);
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: COLLECTION_NAME,
});

const retriever = vectorStore.asRetriever(8);

// Builds a retriever scoped to a course and/or module (see scopeFilter in
// ingest-logic.js). Falls back to the unfiltered retriever only when the
// question carries no scope at all — e.g. legacy queue items saved before
// courseId existed. Note the `metadata.` prefix — Qdrant filter syntax
// requires it.
const getRetriever = (scope = {}) => {
    const filter = scopeFilter(scope);
    return filter ? vectorStore.asRetriever({ k: 8, filter }) : retriever;
};

// Golden-first retrieval: TA-verified answers for this scope are fetched
// separately (they carry metadata.golden=true) and placed ahead of raw
// material in the context, so corrections TAs already made win over the
// documents that produced the original mistake.
async function getGoldenDocs(question, scope = {}) {
    const filter = {
        must: [
            { key: "metadata.golden", match: { value: true } },
            ...(scopeFilter(scope)?.must ?? []),
        ],
    };
    return vectorStore.similaritySearch(question, 3, filter);
}

// 3. RAG Pipeline Configuration
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant. Answer the student's question using ONLY the following context.

Rules:
- Stay as close to the source wording as possible: reuse the context's exact terms, names, dates, and numbers. Sentence structure may differ, but the words and facts must come straight from the material.
- Include every concrete detail relevant to the question — never compress a specific answer (tanks, infantry, air support; France; mid-1940) into a vague generic statement (speed, surprise, force).
- Write the answer as plain, direct prose a student would read.
- Do NOT explain your reasoning, do NOT mention chunk numbers or which chunks you used, do NOT add any notes about your process.
- Do NOT add any fact, example, or detail that is not in the context — no outside knowledge, ever.
- Chunks labeled as verified TA-approved answers take precedence over regular material when they conflict.
- If the answer is not in the context, respond with exactly: "I don't know."
- After the answer, on a new line, list only the chunk numbers you drew from, in this exact format: SOURCES: 1, 3

Context: {context}

Question: {question}

Answer:
`);

const formatDocs = (docs) => docs.map((doc, i) => `Chunk ${i + 1}: ${doc.pageContent}`).join("\n\n");

// Splits the LLM's raw completion into the clean prose answer and a
// separate list of cited chunk numbers, so the "SOURCES: 1, 3" line the
// prompt asks for never ends up shown to students as part of the answer
// text itself.
function splitAnswerAndSources(raw) {
    const match = raw.match(/\n?SOURCES:\s*(.+)$/i);
    if (!match) return { answer: raw.trim(), sources: [] };

    const answer = raw.slice(0, match.index).trim();
    const sources = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    return { answer, sources };
}

// Runs retrieval + generation for a single queue item and saves the result.
// Pulled out of the route handler so /submit-question can fire this off
// without the student's request waiting on it.
async function generateDraftAnswer(item) {
    try {
        const scope = { courseId: item.courseId, moduleId: item.moduleId };

        // Both retrievals resolve eagerly (not inside the runnable) so the
        // exact documents placed in the context can be recorded as
        // citations on the item. A golden failure must not kill the draft —
        // fall back to plain scoped retrieval.
        let goldenDocs = [];
        try {
            goldenDocs = await getGoldenDocs(item.question, scope);
        } catch (goldenError) {
            console.error(`Golden retrieval failed for ${item._id}, continuing without it:`, goldenError.message);
        }
        const docs = await getRetriever(scope).invoke(item.question);

        // Citations come from these retrieved documents — never from the
        // LLM's self-reported SOURCES line, which can hallucinate chunk
        // numbers. Golden (TA-verified) answers carry no page/line, only
        // their source label.
        const toCitation = (doc, golden) => ({
            source: doc.metadata?.source ?? "Unknown source",
            page: doc.metadata?.page ?? null,
            line: doc.metadata?.lineStart ?? null,
            lineEnd: doc.metadata?.lineEnd ?? null,
            golden,
        });
        item.citations = [
            ...goldenDocs.map((doc) => toCitation(doc, true)),
            ...docs.map((doc) => toCitation(doc, false)),
        ].slice(0, 8);

        const golden = goldenDocs
            .map((doc, i) => `Verified answer ${i + 1} (TA-approved): ${doc.pageContent}`)
            .join("\n\n");
        const context = [golden, formatDocs(docs)].filter(Boolean).join("\n\n");

        const ragChain = RunnableSequence.from([
            promptTemplate,
            llm,
            new StringOutputParser()
        ]);

        const rawAnswer = await ragChain.invoke({ context, question: item.question });
        const { answer: draftAnswer, sources } = splitAnswerAndSources(rawAnswer);

        item.draftAnswer = draftAnswer;
        item.sources = sources;
        await item.save();
    } catch (error) {
        console.error(`Error generating draft answer for ${item._id}:`, error);
        // Leave draftAnswer empty rather than crashing — the item just
        // stays invisible to the TA queue (see the /review-queue filter)
        // until someone notices and investigates, instead of showing a
        // broken/half-written draft.
    }
}

// 3.5 Ingestion — called by the backend right after a document is
// uploaded (or deleted), so the vector store actually stays in sync with
// what's in the app. Uploading a document used to only save the file and
// a DB record; nothing ever told the RAG pipeline the document existed,
// which is why questions about newly uploaded material always fell
// through to "I don't know."
app.post('/ingest', async (req, res) => {
    try {
        const { documentId, moduleId, courseId, filename, fileBase64 } = req.body;

        if (!documentId || !filename || !fileBase64) {
            return res.status(400).json({ error: "documentId, filename and fileBase64 are required." });
        }

        const buffer = Buffer.from(fileBase64, "base64");
        const result = await ingestSingleDocument({ buffer, filename, documentId, moduleId, courseId });
        res.json(result);
    } catch (error) {
        console.error("Error ingesting document:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Removes every vector in a course/module scope (documents, golden
// answers, stragglers). Called by the backend on course hard-delete, where
// per-document cleanup alone would leak TA-verified answers — those aren't
// Document records, but they carry the same scope tags.
app.post('/ingest/purge', async (req, res) => {
    try {
        const { moduleIds, courseId } = req.body ?? {};
        const removed = await removeScopeChunks({ moduleIds, courseId });
        res.json({ removed });
    } catch (error) {
        console.error("Error purging vectors:", error);
        res.status(400).json({ error: error.message || "Internal server error" });
    }
});

// Removes a document's chunks (e.g. when it's deleted in the app) so
// stale content doesn't keep showing up in answers.
app.delete('/ingest/:documentId', async (req, res) => {
    try {
        const removed = await removeDocumentChunks(req.params.documentId);
        res.json({ removed });
    } catch (error) {
        console.error("Error removing document chunks:", error);
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
app.post('/submit-question', async (req, res) => {
    try {
        const { student_id, question, module_id, course_id } = req.body;

        if (!question) return res.status(400).json({ error: "Question is required." });

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
            moduleId: module_id ?? null,
            courseId: course_id ?? null,
            question,
        });

        res.json({
            status: "success",
            message: "Question received. Your answer is being reviewed by a TA.",
            request_id: item._id.toString()
        });

        // Fire-and-forget: not awaited, runs after the response is sent.
        generateDraftAnswer(item);

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
app.get('/review-queue', async (req, res) => {
    const filter = {
        status: 'pending',
        draftAnswer: { $ne: "" },
    };
    // Optional course scoping (?courseId=...) so callers can pull one
    // course's queue without sifting the whole platform's. Absent = all
    // pending, preserving the old behavior for existing callers.
    if (req.query.courseId) filter.courseId = req.query.courseId;
    const pending = await ReviewQueueItem.find(filter)
        .sort({ createdAt: 1 })
        .lean();
    res.json(pending);
});

// Purges every Q&A history item tied to any of the given modules. Called
// by the backend when a course is hard-deleted, so a course's questions
// and drafts don't outlive the course itself in this service's own
// MongoDB collection.
app.post('/review-queue/purge', async (req, res) => {
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
app.post('/review-queue/purge-member', async (req, res) => {
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
app.get('/module-history/:moduleId', async (req, res) => {
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

// 7. TA-facing: approve a draft, optionally editing it and/or rating it
// before it goes out. Approving feeds the final answer back into the
// vector store as a golden chunk (see ingestGoldenAnswer) — the feedback
// loop that lets reviewed answers improve future drafts.
app.post('/review-queue/:id/approve', async (req, res) => {
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

    res.json({ status: 'approved', id: item._id.toString(), rating, goldenIngested });
});

// 8. TA-facing: reject a draft (e.g. hallucinated or off-topic).
app.post('/review-queue/:id/reject', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    item.status = 'rejected';
    item.finalAnswer = req.body?.note || "A TA reviewed this question and could not provide an answer from the course materials.";
    await item.save();
    res.json({ status: 'rejected', id: item._id.toString() });
});

// 9. Student-facing: check on / retrieve a submitted question.
// Returns only status while pending; the answer is included only once approved.
app.get('/my-answer/:id', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    if (item.status === 'pending') {
        return res.json({ status: 'pending', message: "Your answer is still being reviewed by a TA." });
    }

    res.json({ status: item.status, answer: item.finalAnswer, rating: item.rating ?? null, citations: item.citations ?? [] });
});

// 10. Student-facing: list everything a given student has ever asked.
// Was previously called by the backend but never implemented here.
app.get('/my-answers/:studentId', async (req, res) => {
    const items = await ReviewQueueItem.find({ studentId: req.params.studentId })
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
            createdAt: item.createdAt,
        }))
    );
});

// 11. Student-facing: quick counts of how their questions have fared.
// Was previously called by the backend but never implemented here.
app.get('/stats/:studentId', async (req, res) => {
    const { studentId } = req.params;

    const [total, pending, approved, rejected] = await Promise.all([
        ReviewQueueItem.countDocuments({ studentId }),
        ReviewQueueItem.countDocuments({ studentId, status: 'pending' }),
        ReviewQueueItem.countDocuments({ studentId, status: 'approved' }),
        ReviewQueueItem.countDocuments({ studentId, status: 'rejected' }),
    ]);

    res.json({ total, pending, approved, rejected });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
