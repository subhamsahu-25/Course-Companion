// node calibrate-goldens.js — DATA-driven auto-serve threshold.
//
// Pulls your REAL approved ("golden") answers from Mongo, generates a
// paraphrase AND a hard-negative lookalike for each via the light model,
// then scores them against the exact text stored in the vector DB
// (`Question: <text>` — see ingestGoldenAnswer). Prints the true-paraphrase
// band vs the false/negative bands and suggests a threshold that separates
// them. Read-only on the database.
import 'dotenv/config';
import mongoose from 'mongoose';
import ReviewQueueItem from './models/ReviewQueueItem.js';
import { getEmbeddings, buildKeyedChatModel, LIGHT_MODEL, GEMINI_API_KEY } from './clients.js';
import { SERVABLE_RATINGS, AUTO_SERVE_SIMILARITY, normalizeQuestion } from './services/retrieval.js';

if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — cannot calibrate.');
    process.exit(1);
}

const cos = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
const items = await ReviewQueueItem.find({ status: 'approved' }).lean();
const servable = items.filter((i) => i.question && SERVABLE_RATINGS(i.rating));
// Duplicate questions are the same golden N times — cross-matching them
// looks like a false positive but is harmless (answering a repeat from a
// duplicate of itself). Dedupe so the bands aren't polluted.
const seen = new Set();
const goldens = servable.filter((i) => {
    const k = normalizeQuestion(i.question);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
});
if (goldens.length < 2) {
    console.error(`Only ${goldens.length} distinct servable golden answer(s) — need at least 2 to calibrate.`);
    await mongoose.disconnect();
    process.exit(1);
}
console.log(`Loaded ${servable.length} golden answers, ${goldens.length} distinct (rating ≥3 or unrated).\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const llm = buildKeyedChatModel(LIGHT_MODEL);
const ask = async (prompt) => {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const res = await llm.invoke(prompt);
            const c = res?.content;
            return (typeof c === 'string' ? c : (c || []).map((p) => p?.text || '').join('')).trim();
        } catch (e) {
            const msg = e?.message || '';
            if (!/429|quota|rate.?limit/i.test(msg)) throw e;
            const m = /retry in ([\d.]+)s/i.exec(msg);
            const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 2000 : 8000 * (attempt + 1);
            console.log(`  (rate-limited — waiting ${Math.round(wait / 1000)}s…)`);
            await sleep(wait);
        }
    }
    throw new Error('still rate-limited after retries');
};

const gen = async (label, prompt, q) => {
    try {
        const out = await ask(`${prompt}\n\nQuestion: ${q}`);
        return (out || '').replace(/^["']|["']$/g, '').trim() || null;
    } catch (e) {
        console.error(`  (${label} failed for "${q.slice(0, 40)}…": ${e.message})`);
        return null;
    }
};

console.log('Generating paraphrases + hard negatives…');
const rows = [];
for (const g of goldens) {
    const paraphrase = await gen('paraphrase',
        'Rewrite this student question in different words but keep the EXACT same meaning and intent. Return ONLY the rewritten question.',
        g.question);
    const hardNeg = await gen('hard-negative',
        'Rewrite this student question so it asks about a DIFFERENT but related aspect, keeping as many of the same words as possible. It must NOT share the same answer. Return ONLY the rewritten question.',
        g.question);
    rows.push({ g, paraphrase, hardNeg });
    await sleep(3000);
}

const embeddings = getEmbeddings();
const targetTexts = goldens.map((g) => `Question: ${g.question}`);
console.log('Embedding golden questions…');
const targetVecs = await embeddings.embedDocuments(targetTexts);

const paraVecs = [];
const hardVecs = [];
console.log('Embedding generated variants…');
for (const r of rows) {
    const [pv] = r.paraphrase ? await embeddings.embedDocuments([r.paraphrase]) : [null];
    const [hv] = r.hardNeg ? await embeddings.embedDocuments([r.hardNeg]) : [null];
    paraVecs.push(pv);
    hardVecs.push(hv);
}

const scopeKey = (g) => String(g.courseId ?? 'ALL');
const trueScores = [];
const falseScores = [];
const hardScores = [];

console.log('\n  TRUE  CROSS  HARD   question');
console.log('  ----  -----  ----   --------');
rows.forEach((r, i) => {
    const t = paraVecs[i] ? cos(paraVecs[i], targetVecs[i]) : null;
    let cross = null;
    if (paraVecs[i]) {
        for (let j = 0; j < targetVecs.length; j++) {
            if (j === i) continue;
            if (scopeKey(goldens[j]) !== scopeKey(r.g)) continue;
            const s = cos(paraVecs[i], targetVecs[j]);
            if (cross === null || s > cross) cross = s;
        }
    }
    const h = hardVecs[i] ? cos(hardVecs[i], targetVecs[i]) : null;
    if (t !== null) trueScores.push(t);
    if (cross !== null) falseScores.push(cross);
    if (h !== null) hardScores.push(h);
    const f = (x) => (x === null ? '  — ' : x.toFixed(3));
    console.log(`  ${f(t)}  ${f(cross)}  ${f(h)}   ${r.g.question.slice(0, 56)}`);
});

const maxCross = falseScores.length ? Math.max(...falseScores) : 0;
const maxHard = hardScores.length ? Math.max(...hardScores) : 0;
const minTrue = trueScores.length ? Math.min(...trueScores) : 1;
console.log(`\ncurrent threshold:           ${AUTO_SERVE_SIMILARITY.toFixed(3)}`);
console.log(`lowest  TRUE score:          ${minTrue.toFixed(3)}  (paraphrase of its own golden)`);
console.log(`highest CROSS score:         ${maxCross.toFixed(3)}  (an unrelated golden in scope — the real false-positive risk)`);
console.log(`highest HARD score:          ${maxHard.toFixed(3)}  [advisory only — LLM "lookalikes" often end up near-duplicates]`);
// Calibrate on TRUE vs CROSS. Cross goldens are genuinely different
// questions, so they are the correct negative class; the LLM-generated
// hard negatives are unreliable and only reported for inspection.
if (maxCross < minTrue) {
    const suggested = Math.round(((maxCross + minTrue) / 2) * 1000) / 1000;
    console.log(`suggested threshold:         ${suggested.toFixed(3)}  (clean split between ${maxCross.toFixed(3)} and ${minTrue.toFixed(3)})`);
    if (AUTO_SERVE_SIMILARITY > minTrue) {
        console.log(`\n=> current ${AUTO_SERVE_SIMILARITY.toFixed(2)} is ABOVE your lowest true paraphrase (${minTrue.toFixed(3)}):`);
        console.log('   the similarity leg misses legitimate paraphrases. Lower it toward the suggested value.');
    }
} else {
    console.log('OVERLAP: unrelated questions score as high as paraphrases — improve chunks/goldens before trusting auto-serve.');
}

await mongoose.disconnect();
