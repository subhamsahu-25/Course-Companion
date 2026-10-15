// node measure-retrieval.js — hit rate of the right chunk in the top 3,
// per eval/retrieval-set.json. Run BEFORE changing chunking/retrieval so
// every experiment (chunk 500->800, top-k, MMR) is judged against a
// number, not a feeling. Needs Qdrant + Gemini reachable.
import 'dotenv/config';
import fs from 'node:fs';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { getQdrantClient, getCollectionName, ensureQdrantCollection } from "./qdrant.js";
import { scopeFilter } from "./ingest-logic.js";

const { cases } = JSON.parse(fs.readFileSync(new URL("./eval/retrieval-set.json", import.meta.url)));
const real = (cases || []).filter((c) => !String(c.question).startsWith("TEMPLATE"));
if (real.length === 0) {
    console.error("No real cases in eval/retrieval-set.json — replace the TEMPLATE entries first.");
    process.exit(1);
}

const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-001",
});
const client = getQdrantClient();
const collectionName = getCollectionName();
await ensureQdrantCollection(client, collectionName);
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
});

let top1 = 0;
let top3 = 0;
for (const c of real) {
    const filter = scopeFilter({ courseId: c.courseId, moduleId: c.moduleId });
    const docs = await vectorStore.similaritySearch(c.question, 3, filter);
    const sources = docs.map((d) => d.metadata?.source);
    const hit1 = sources[0] === c.expectedSource;
    const hit3 = sources.includes(c.expectedSource);
    if (hit1) top1 += 1;
    if (hit3) top3 += 1;
    const pageOk = c.expectedPage == null || docs.some((d) => d.metadata?.page === c.expectedPage);
    console.log(`${hit3 ? "HIT " : "MISS"} top1=${hit1} page=${c.expectedPage == null ? "-" : pageOk} :: ${c.question.slice(0, 70)}`);
    console.log(`      got: ${sources.join(" | ") || "(nothing)"}`);
}

console.log(`\ntop-1: ${top1}/${real.length} (${((top1 / real.length) * 100).toFixed(0)}%)`);
console.log(`top-3: ${top3}/${real.length} (${((top3 / real.length) * 100).toFixed(0)}%)`);
console.log("Change ONE thing (chunk size, k, MMR), re-run, keep it only if top-3 rises.");
