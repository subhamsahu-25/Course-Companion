import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'crypto';
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

// Local Ollama AI modules
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

// Connection to the external Vector Database
import { Chroma } from "@langchain/community/vectorstores/chroma";

const app = express();
app.use(express.json());

// 1. Initialize local Ollama AI
const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text", 
    baseUrl: "http://localhost:11434"
});

const llm = new ChatOllama({
    model: "llama3", 
    temperature: 0,
    baseUrl: "http://localhost:11434"
});

// 2. Connect to the existing Vector Database
// This replaces all ingestion code. It simply connects to the database 
// you populated earlier using your separate ingest.js script.
const vectorStore = new Chroma(embeddings, {
    collectionName: "course_collection",
    url: "http://localhost:8000" 
});

const retriever = vectorStore.asRetriever(5);

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

// 4. TA Review Queue
// A draft answer sits here in "pending" status until a TA approves or
// rejects it. Students can never read draft/pending content — only an
// approved final answer, fetched through /my-answer/:id.
const reviewQueue = new Map(); // id -> { id, student_id, question, draftAnswer, status, finalAnswer, createdAt }

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

        const id = randomUUID();
        reviewQueue.set(id, {
            id,
            student_id: student_id ?? null,
            question,
            draftAnswer,
            status: 'pending',
            finalAnswer: null,
            createdAt: new Date().toISOString()
        });

        res.json({
            status: "success",
            message: "Question received. Your answer is being reviewed by a TA.",
            request_id: id
        });

    } catch (error) {
        console.error("Error processing question:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 6. TA-facing: list everything still awaiting review.
app.get('/review-queue', (req, res) => {
    const pending = [...reviewQueue.values()].filter(item => item.status === 'pending');
    res.json(pending);
});

// 7. TA-facing: approve a draft, optionally editing it before it goes out.
app.post('/review-queue/:id/approve', (req, res) => {
    const item = reviewQueue.get(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    item.status = 'approved';
    item.finalAnswer = req.body?.editedAnswer || item.draftAnswer;
    res.json({ status: 'approved', id: item.id });
});

// 8. TA-facing: reject a draft (e.g. hallucinated or off-topic).
app.post('/review-queue/:id/reject', (req, res) => {
    const item = reviewQueue.get(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    item.status = 'rejected';
    item.finalAnswer = req.body?.note || "A TA reviewed this question and could not provide an answer from the course materials.";
    res.json({ status: 'rejected', id: item.id });
});

// 9. Student-facing: check on / retrieve a submitted question.
// Returns only status while pending; the answer is included only once approved.
app.get('/my-answer/:id', (req, res) => {
    const item = reviewQueue.get(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });

    if (item.status === 'pending') {
        return res.json({ status: 'pending', message: "Your answer is still being reviewed by a TA." });
    }

    res.json({ status: item.status, answer: item.finalAnswer });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
