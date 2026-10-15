import { PromptTemplate } from "@langchain/core/prompts";

// 3. RAG Pipeline Configuration
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful teaching assistant. Answer the student's question using ONLY the following context.

Rules:
- If one or more chunks contain information relevant to the question, ANSWER FROM THEM — even if no single chunk holds the complete answer. Combine relevant chunks freely.
- Stay as close to the source wording as possible: reuse the context's exact terms, names, dates, and numbers. Sentence structure may differ, but the words and facts must come straight from the material.
- Include every concrete detail relevant to the question — never compress a specific answer (tanks, infantry, air support; France; mid-1940) into a vague generic statement (speed, surprise, force).
- Format for scanning: when the answer holds multiple distinct points, steps, causes, or items, list them as bullets (-) or numbers (1.) — one idea per line, never a wall of paragraph. Single-point answers stay as short prose.
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
- Format for scanning: multiple distinct points, steps, causes, or items go as bullets (-) or numbers (1.), one idea per line — never a single paragraph. Single-point answers stay as short prose.
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

export { promptTemplate, directPromptTemplate, formatDocs, splitAnswerAndSources };
