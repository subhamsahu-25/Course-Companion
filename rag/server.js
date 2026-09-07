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

const app = express();
app.use(express.json());

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

const retriever = vectorStore.asRetriever(8);

// 3. RAG Pipeline Configuration
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant. Answer the student's question using ONLY the following context. 
If the answer is not in the context, say "I don't know."
Always include citations to the context chunks you used (e.g., [Chunk 1]).

Context: {context}

Question: {question}

Answer:
`);

const formatDocs = (docs) => {
    const formatted = docs.map((doc, i) => `Chunk ${i + 1}: ${doc.pageContent}`).join("\n\n");
    console.log("---- RETRIEVED CONTEXT ----\n", formatted, "\n---------------------------");
    return formatted;
};

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
        const { student_id, question } = req.body;

        if (!question) return res.status(400).json({ error: "Question is required." });

        const ragChain = RunnableSequence.from([
            {
                context: retriever.pipe(formatDocs),
                question: new RunnablePassthrough()
            },
            promptTemplate,
            llm,
            new StringOutputParser()
        ]);

        const draftAnswer = await ragChain.invoke(question);

        const item = await ReviewQueueItem.create({
            studentId: student_id ?? null,
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
import { ingestDocuments } from './ingest-logic.js';

// 12. Internal: re-run ingestion over everything in course_materials.
// Called by the main backend right after a PDF upload so newly added
// material becomes searchable without a manual `node ingest.js` step.
app.post('/ingest', async (req, res) => {
    try {
        const result = await ingestDocuments();
        res.json({ status: 'success', ...result });
    } catch (error) {
        console.error("Error during ingestion:", error);
        res.status(500).json({ error: "Ingestion failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
