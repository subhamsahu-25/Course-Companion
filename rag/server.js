import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

// Local Ollama AI modules
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

// Connection to the external Vector Database
import { Chroma } from "@langchain/community/vectorstores/chroma";

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
        draftAnswer: { type: String, required: true },
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

// 1. Initialize local Ollama AI
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: OLLAMA_BASE_URL
});

const llm = new ChatOllama({
    model: "llama3",
    temperature: 0,
    baseUrl: OLLAMA_BASE_URL
});

// 2. Connect to the existing Vector Database
// This replaces all ingestion code. It simply connects to the database
// you populated earlier using your separate ingest.js script.
const vectorStore = new Chroma(embeddings, {
    collectionName: "course_collection",
    url: process.env.CHROMA_URL || "http://localhost:8000"
});

const retriever = vectorStore.asRetriever(5);

// Builds a retriever scoped to one module's chunks when a moduleId is
// given, otherwise falls back to the unfiltered retriever above. Chunks
// only carry a moduleId once they've gone through ingestSingleDocument
// (see ingest-logic.js), so older bulk-seeded material without that tag
// won't match a module-scoped query.
const getRetriever = (moduleId) =>
    moduleId ? vectorStore.asRetriever({ k: 5, filter: { moduleId } }) : retriever;

// 3. RAG Pipeline Configuration
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant. Answer the student's question using ONLY the following context. 
If the answer is not in the context, say "I don't know."
Always include citations to the context chunks you used (e.g., [Chunk 1]).

Context: {context}

Question: {question}

Answer:
`);

const formatDocs = (docs) => docs.map((doc, i) => `Chunk ${i + 1}: ${doc.pageContent}`).join("\n\n");

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
// Runs the RAG pipeline, but only returns a request id + status —
// never the draft itself.
app.post('/submit-question', async (req, res) => {
    try {
        const { student_id, question, module_id } = req.body;

        if (!question) return res.status(400).json({ error: "Question is required." });

        const ragChain = RunnableSequence.from([
            {
                context: getRetriever(module_id).pipe(formatDocs),
                question: new RunnablePassthrough()
            },
            promptTemplate,
            llm,
            new StringOutputParser()
        ]);

        const draftAnswer = await ragChain.invoke(question);

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
            moduleId: module_id ?? null,
            question,
            draftAnswer,
        });

        res.json({
            status: "success",
            message: "Question received. Your answer is being reviewed by a TA.",
            request_id: item._id.toString()
        });

    } catch (error) {
        console.error("Error processing question:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 6. TA-facing: list everything still awaiting review.
app.get('/review-queue', async (req, res) => {
    const pending = await ReviewQueueItem.find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .lean();
    res.json(pending);
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
