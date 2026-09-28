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
        // Retrieval confidence: cosine score of the best material chunk
        // behind this draft (0–1, null when nothing was retrieved). Lets
        // the TA queue triage shakiest-first instead of oldest-first.
        confidence: { type: Number, default: null },
        // True when the TA edited the draft before approving — lets the
        // feedback loop (and future analytics) tell "approved as-is" apart
        // from "approved with corrections".
        wasEdited: { type: Boolean, default: false },
        // Follow-up thread: the root question's item id. Follow-ups share
        // their thread's resolved history as extra context, so students
        // don't restate everything per question.
        threadId: { type: String, default: null, index: true },
        // TA userIds that marked this question important. A checkbox per
        // card, togglable — when marks from distinct TAs reach
        // IMPORTANT_THRESHOLD, the question surfaces on the instructor
        // portal ("important questions" below the TA roster).
        importantBy: { type: [String], default: [] },
        // Normalized question text (lowercased, punctuation/whitespace
        // collapsed) for exact repeat detection — the first leg of
        // instant answers. Stored at creation so repeats match with an
        // indexed query instead of embedding every submission.
        normalizedQuestion: { type: String, default: null, index: true },
        // True when this item never saw the TA queue: the question matched
        // a verified answer closely enough to serve instantly. servedFrom
        // points at the approved item it was answered from.
        autoServed: { type: Boolean, default: false },
        servedFrom: { type: String, default: null },
        // Who resolved the review (approve or reject) and when — powers
        // the instructor's per-TA "questions reviewed" counts. Null for
        // items resolved before this existed.
        reviewedBy: { type: String, default: null },
        reviewedAt: { type: Date, default: null },
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

// Primary chat model (env-overridable). On quota/rate-limit failures the
// draft automatically replays once against FALLBACK_MODEL instead of
// dying — max quality while budget lasts, graceful degradation after.
// Set GEMINI_MODEL=gemini-3.1-flash-lite to run cheap everywhere; leave
// both unset for 3.6 primary with lite fallback.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

function buildChatModel(model) {
   return new ChatGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
      model,
      temperature: 0,
   });
}

const llm = buildChatModel(PRIMARY_MODEL);
let fallbackLlm = null;
function getFallbackLlm() {
   if (!fallbackLlm) fallbackLlm = buildChatModel(FALLBACK_MODEL);
   return fallbackLlm;
}

// True when the failure is quota/rate-limiting (worth replaying on the
// fallback) as opposed to a real error (bad request, auth, network).
function isQuotaError(error) {
   if (error?.status === 429) return true;
   return /429|quota|rate.?limit|exhausted|retry.?later/i.test(error?.message || "");
}

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
- If one or more chunks contain information relevant to the question, ANSWER FROM THEM — even if no single chunk holds the complete answer. Combine relevant chunks freely.
- Stay as close to the source wording as possible: reuse the context's exact terms, names, dates, and numbers. Sentence structure may differ, but the words and facts must come straight from the material.
- Include every concrete detail relevant to the question — never compress a specific answer (tanks, infantry, air support; France; mid-1940) into a vague generic statement (speed, surprise, force).
- Write the answer as plain, direct prose a student would read.
- Do NOT explain your reasoning, do NOT mention chunk numbers or which chunks you used, do NOT add any notes about your process.
- Every name, date, number, and factual claim in your answer must appear in the context — only plain grammar and connective words may be your own. If a question can only be answered with facts missing from the context, respond with exactly: "I don't know."
- Chunks labeled as verified TA-approved answers take precedence over regular material when they conflict.
- Only when NONE of the context is relevant to the question, respond with exactly: "I don't know."
- After the answer, on a new line, list only the chunk numbers you drew from, in this exact format: SOURCES: 1, 3

Context: {context}

Question: {question}

Answer:
`);

// Relaxed twin of the prompt above, used ONLY for direct follow-up
// answers (never TA-reviewed). A follow-up may legitimately wander off
// the material — e.g. "define this term from your answer" where the PDF
// uses but never defines it. Forcing "I don't know." there would be
// pedantic, so general knowledge is allowed with one hard rule: anything
// beyond the context must be labeled as such, so students never mistake
// it for course material.
const directPromptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant continuing a conversation with a student. Use the context below first.

Rules:
- Stay as close to the source wording as possible for anything the context covers: reuse its exact terms, names, dates, and numbers.
- If the question goes beyond the context (e.g. defining a term the material uses but never defines), answer from general knowledge — but begin the answer with exactly: (Beyond course material)
- Do NOT explain your reasoning, do NOT mention chunk numbers or which chunks you used, do NOT add any notes about your process.
- Write the answer as plain, direct prose a student would read.
- After the answer, on a new line, list only the chunk numbers you drew from, in this exact format: SOURCES: 1, 3. If you used no chunks, write exactly: SOURCES: none

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
// When `direct` is true the relaxed follow-up prompt applies (general
// knowledge allowed, labeled) instead of the strict grounded one. Only
// the direct-answer path passes true — everything TA-reviewed stays on
// the strict prompt.
async function generateDraftAnswer(item, { direct = false } = {}) {
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
        // Scored (not plain) retrieval: the top cosine score becomes the
        // draft's confidence. Unscoped questions keep the old unfiltered
        // retriever path and record no confidence.
        const materialFilter = scopeFilter(scope);
        let docs;
        if (materialFilter) {
            const scored = await vectorStore.similaritySearchWithScore(
                item.question,
                8,
                materialFilter
            );
            docs = scored.map(([doc]) => doc);
            item.confidence = scored.length > 0 ? +scored[0][1].toFixed(3) : null;
        } else {
            docs = await retriever.invoke(item.question);
            item.confidence = null;
        }

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

        // Thread history: resolved Q&A from the same follow-up thread,
        // so "what about France then?" inherits everything established
        // above without restating. Pending items excluded (nothing to
        // learn from an unreviewed draft), capped at 5 to bound context.
        let threadContext = "";
        if (item.threadId) {
            try {
                const prior = await ReviewQueueItem.find({
                    threadId: item.threadId,
                    _id: { $ne: item._id },
                    status: { $ne: 'pending' },
                    finalAnswer: { $ne: null },
                })
                    .sort({ createdAt: 1 })
                    .limit(5)
                    .lean();
                if (prior.length > 0) {
                    threadContext = "Earlier in this thread:\n" + prior
                        .map((p) => `Q: ${p.question}\nA: ${p.finalAnswer}`)
                        .join("\n\n");
                }
            } catch (threadError) {
                console.error(`Thread context failed for ${item._id}, continuing without it:`, threadError.message);
            }
        }

        const golden = goldenDocs
            .map((doc, i) => `Verified answer ${i + 1} (TA-approved): ${doc.pageContent}`)
            .join("\n\n");
        const context = [threadContext, golden, formatDocs(docs)].filter(Boolean).join("\n\n");

        const buildChain = (model) =>
            RunnableSequence.from([
                direct ? directPromptTemplate : promptTemplate,
                model,
                new StringOutputParser()
            ]);

        let rawAnswer;
        try {
            rawAnswer = await buildChain(llm).invoke({ context, question: item.question });
        } catch (primaryError) {
            // Same prompt, cheaper model — only for quota failures and
            // only when the fallback actually differs from primary.
            if (FALLBACK_MODEL !== PRIMARY_MODEL && isQuotaError(primaryError)) {
                console.error(
                    `Primary model ${PRIMARY_MODEL} quota-hit for ${item._id}, replaying on ${FALLBACK_MODEL}.`
                );
                rawAnswer = await buildChain(getFallbackLlm()).invoke({
                    context,
                    question: item.question,
                });
            } else {
                throw primaryError;
            }
        }
        const { answer: draftAnswer, sources } = splitAnswerAndSources(rawAnswer);

        item.draftAnswer = draftAnswer;
        item.sources = sources;
        await item.save();
        return { draftAnswer, sources };
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
// Looks for a verified answer to serve instantly (no TA review). Two
// legs, cheapest first: (1) exact normalized-text match against approved
// items in the same scope — can't false-positive; (2) golden-chunk cosine
// similarity at AUTO_SERVE_SIMILARITY — near-certain paraphrases only.
// Both legs require a servable rating (unrated or ≥3). Returns the source
// item or null.
async function findInstantAnswer(question, scope) {
    const norm = normalizeQuestion(question);
    if (norm) {
        const exact = await ReviewQueueItem.findOne({
            courseId: scope.courseId ?? null,
            moduleId: scope.moduleId ?? null,
            normalizedQuestion: norm,
            status: 'approved',
        })
            .sort({ createdAt: -1 })
            .lean();
        if (exact && SERVABLE_RATINGS(exact.rating)) return exact;
    }

    // Scored top-1 over golden chunks only — similaritySearch (unscored)
    // can't gatekeep, and an unreviewed wrong answer must never auto-serve.
    try {
        const scored = await vectorStore.similaritySearchWithScore(
            question,
            1,
            {
                must: [
                    { key: "metadata.golden", match: { value: true } },
                    ...(scopeFilter(scope)?.must ?? []),
                ],
            }
        );
        if (scored.length > 0 && scored[0][1] >= AUTO_SERVE_SIMILARITY) {
            const documentId = String(scored[0][0].metadata?.documentId ?? '');
            if (documentId.startsWith('golden:')) {
                const source = await ReviewQueueItem.findOne({
                    _id: documentId.replace(/^golden:/, ''),
                    status: 'approved',
                }).lean();
                if (source && SERVABLE_RATINGS(source.rating)) return source;
            }
        }
    } catch (err) {
        console.error("Instant-answer lookup failed, falling back to queue:", err.message);
    }
    return null;
}

app.post('/submit-question', async (req, res) => {
    try {
        const { student_id, question, module_id, course_id, thread_id } = req.body;

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
            const generated = await generateDraftAnswer(item, { direct: true });
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

// Distinct-TA important marks needed before a question is highlighted to
// the instructor. Low on purpose: most courses have a handful of TAs, so
// 2 means "more than one TA independently flagged this".
const IMPORTANT_THRESHOLD = 2;

// Minimum golden-chunk cosine similarity for an instant answer. Deliberately
// high: a false positive serves a wrong answer with no human ever looking,
// so paraphrase matches must be near-certain. Exact normalized matches
// bypass this entirely (they can't false-positive).
const AUTO_SERVE_SIMILARITY = 0.85;

// Ratings that may teach or auto-serve. Mirrors the golden policy: 1–2
// star approvals are quarantined from both.
const SERVABLE_RATINGS = (rating) => rating === null || rating === undefined || rating >= 3;

// Normalizes a question for exact repeat detection.
function normalizeQuestion(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

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
app.post('/review-queue/:id/reject', async (req, res) => {
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
app.post('/review-queue/:id/important', async (req, res) => {
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
app.get('/related-questions', async (req, res) => {
    try {
        const { q, courseId, moduleId, limit } = req.query;
        if (!q || q.trim().length < 3) return res.json([]);

        const k = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
        const must = [{ key: "metadata.golden", match: { value: true } }];
        if (courseId) must.push({ key: "metadata.courseId", match: { value: courseId } });
        if (moduleId) must.push({ key: "metadata.moduleId", match: { value: moduleId } });

        const scored = await vectorStore.similaritySearchWithScore(q, k * 2, { must });

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

// Questions highlighted to the instructor: non-rejected items in a course
// with at least IMPORTANT_THRESHOLD distinct-TA marks, hottest first.
// "Just the questions" — the instructor portal renders question text +
// mark counts, nothing else from these rows is needed... except moduleId
// so it can label which module each came from.
app.get('/review-queue/important', async (req, res) => {
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
app.get('/review-queue/course-stats', async (req, res) => {
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
// Thread (chatbot) items are excluded by default — the History page shows
// only fresh questions + TA-reviewed answers, while threads live in the
// chatbot. Pass ?includeThreads=1 for the full set (thread view, stats).
app.get('/my-answers/:studentId', async (req, res) => {
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
