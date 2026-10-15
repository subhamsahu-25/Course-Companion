// node calibrate-autoserve.js — prints cosine scores for every pair in
// eval/autoserve-pairs.json so AUTO_SERVE_SIMILARITY is picked from DATA,
// not vibes. Needs Qdrant + Gemini reachable (same env as server.js).
// Goal: threshold ABOVE the highest false-pair score and AT/BELOW the
// lowest true-pair score. If the ranges overlap, the threshold can't
// separate them — that's a signal to improve chunks, not to guess.
import 'dotenv/config';
import fs from 'node:fs';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const pairs = JSON.parse(fs.readFileSync(new URL("./eval/autoserve-pairs.json", import.meta.url))).pairs;
if (!pairs?.length) {
    console.error("No pairs in eval/autoserve-pairs.json — add real course pairs first.");
    process.exit(1);
}

const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-001",
});
const rows = [];
for (const { a, b, same } of pairs) {
    const [ea] = await embeddings.embedDocuments([a]);
    const [eb] = await embeddings.embedDocuments([b]);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < ea.length; i++) {
        dot += ea[i] * eb[i];
        na += ea[i] * ea[i];
        nb += eb[i] * eb[i];
    }
    const score = dot / (Math.sqrt(na) * Math.sqrt(nb));
    rows.push({ score, same, a: a.slice(0, 60), b: b.slice(0, 60) });
}

rows.sort((x, y) => x.score - y.score);
for (const row of rows) {
    console.log(`${row.score.toFixed(3)}  [${row.same ? "SAME " : "DIFFER"}] ${row.a}  ||  ${row.b}`);
}

const maxFalse = Math.max(-1, ...rows.filter((r) => !r.same).map((r) => r.score));
const minTrue = Math.min(2, ...rows.filter((r) => r.same).map((r) => r.score));
console.log(`\nhighest DIFFER score: ${maxFalse.toFixed(3)}`);
console.log(`lowest SAME score:     ${minTrue.toFixed(3)}`);
if (maxFalse < minTrue) {
    console.log(`suggested threshold: ${((maxFalse + minTrue) / 2).toFixed(3)} (clean split)`);
} else {
    console.log("OVERLAP: no threshold separates these — improve chunks/retrieval before trusting auto-serve.");
}
