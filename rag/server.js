import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

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
import { ingestSingleDocument, removeDocumentChunks } from "./ingest-logic.js";

const app = express();
// Raised from the default 100kb limit: the backend sends uploaded files
// here as base64 JSON, which needs headroom for anything near the 50MB
// upload cap the backend enforces.
app.use(express.json({ limit: "65mb" }));

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
    // gemini-2.0-flash was shut down by Google on June 1, 2026. Using the
    // lightweight 3.1 Flash-Lite here since this call is just "answer from
    // retrieved chunks" — no heavy reasoning needed. Swap to
    // "gemini-3.6-flash" if answer quality needs to go up.
    model: "gemini-3.1-flash-lite",
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

const retriever = vectorStore.asRetriever(5);

// Builds a retriever scoped to one module's chunks when a moduleId is
// given, otherwise falls back to the unfiltered retriever above. Chunks
// only carry a moduleId once they've gone through ingestSingleDocument
// (see ingest-logic.js), so older bulk-seeded material without that tag
// won't match a module-scoped query. Note the `metadata.` prefix — Qdrant
// filter syntax requires it.
const getRetriever = (moduleId) =>
    moduleId
        ? vectorStore.asRetriever({
            k: 5,
            filter: { must: [{ key: "metadata.moduleId", match: { value: moduleId } }] },
        })
        : retriever;

// 3. RAG Pipeline Configuration
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant. Answer the student's question using ONLY the following context.

Rules:
- Write the answer as plain, direct prose a student would read.
- Do NOT explain your reasoning, do NOT mention chunk numbers or which chunks you used, do NOT add any notes about your process.
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
        const ragChain = RunnableSequence.from([
            {
                context: getRetriever(item.moduleId).pipe(formatDocs),
                question: new RunnablePassthrough()
            },
            promptTemplate,
            llm,
            new StringOutputParser()
        ]);

        const rawAnswer = await ragChain.invoke(item.question);
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
        const { documentId, moduleId, filename, fileBase64 } = req.body;

        if (!documentId || !filename || !fileBase64) {
            return res.status(400).json({ error: "documentId, filename and fileBase64 are required." });
        }

        const buffer = Buffer.from(fileBase64, "base64");
        const result = await ingestSingleDocument({ buffer, filename, documentId, moduleId });
        res.json(result);
    } catch (error) {
        console.error("Error ingesting document:", error);
        res.status(500).json({ error: "Internal server error" });
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
        const { student_id, question, module_id } = req.body;

        if (!question) return res.status(400).json({ error: "Question is required." });

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
            moduleId: module_id ?? null,
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
    const pending = await ReviewQueueItem.find({
        status: 'pending',
        draftAnswer: { $ne: "" },
    })
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

// 7. TA-facing: approve a draft, optionally editing it before it goes out.
app.post('/review-queue/:id/approve', async (req, res) => {
    const item = await ReviewQueueItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    item.status = 'approved';
    item.finalAnswer = req.body?.editedAnswer || item.draftAnswer;
    await item.save();
    res.json({ status: 'approved', id: item._id.toString() });
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

    res.json({ status: item.status, answer: item.finalAnswer });
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
            question: item.question,
            status: item.status,
            answer: item.status === 'pending' ? null : item.finalAnswer,
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
