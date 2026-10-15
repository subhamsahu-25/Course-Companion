// rag/services/retrieval.js — everything that FINDS things: scoped
// filters, golden lookup, instant-answer matching, and the text
// normalization behind repeat detection. Generation lives in answers.js.
import ReviewQueueItem from "../models/ReviewQueueItem.js";
import { getVectorStore } from "../clients.js";
import { scopeFilter } from "../ingest-logic.js";

// Minimum golden-chunk cosine similarity for an instant answer. Calibrated
// upward from 0.85 (see calibrate-autoserve.js): a false positive serves a
// wrong answer with no human ever looking, so paraphrase matches must be
// near-certain. Exact normalized matches bypass this entirely (they can't
// false-positive).
export const AUTO_SERVE_SIMILARITY = 0.9;

// Ratings that may teach or auto-serve. Mirrors the golden policy: 1–2
// star approvals are quarantined from both.
export const SERVABLE_RATINGS = (rating) => rating === null || rating === undefined || rating >= 3;

// Normalizes a question for exact repeat detection.
export function normalizeQuestion(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Golden-first retrieval: TA-verified answers for this scope are fetched
// separately (they carry metadata.golden=true) and placed ahead of raw
// material in the context, so corrections TAs already made win over the
// documents that produced the original mistake.
export async function getGoldenDocs(question, scope = {}) {
    const filter = {
        must: [
            { key: "metadata.golden", match: { value: true } },
            ...(scopeFilter(scope)?.must ?? []),
        ],
    };
    return getVectorStore().similaritySearch(question, 3, filter);
}

// Looks for a verified answer to serve instantly (no TA review). Two
// legs, cheapest first: (1) exact normalized-text match against approved
// items in the same scope — can't false-positive; (2) golden-chunk cosine
// similarity at AUTO_SERVE_SIMILARITY — near-certain paraphrases only.
// Both legs require a servable rating (unrated or ≥3). Returns the source
// item or null.
export async function findInstantAnswer(question, scope) {
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
        const scored = await getVectorStore().similaritySearchWithScore(
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
