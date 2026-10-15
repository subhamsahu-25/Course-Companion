import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import ReviewQueueItem from "../models/ReviewQueueItem.js";
import {
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    LIGHT_MODEL,
    buildKeyedChatModel,
    isQuotaError,
    isInvalidKeyError,
    checkUserKeyHealth,
    noteUserKeyFailure,
    clearUserKeyHealth,
    recordSharedQuotaFailure,
    getVectorStore,
    getRetriever,
} from "../clients.js";
import {
    promptTemplate,
    directPromptTemplate,
    formatDocs,
    splitAnswerAndSources,
} from "../prompts.js";
import { getGoldenDocs } from "./retrieval.js";
import { scopeFilter } from "../ingest-logic.js";

// Runs retrieval + generation for a single queue item and saves the result.
// Pulled out of the route handler so /submit-question can fire this off
// without the student's request waiting on it.
// When `direct` is true the relaxed follow-up prompt applies (general
// knowledge allowed, labeled) instead of the strict grounded one. Only
// the direct-answer path passes true — everything TA-reviewed stays on
// the strict prompt.
// Funding ladder per draft: the asker's own key first (their quota),
// then the shared primary, then the shared fallback — each step only on
// quota-shaped failures (or a bad user key, which also degrades
// gracefully). Returns funding metadata alongside the draft so callers
// can meter and cool down keys. chatApiKey is never stored or logged.
async function generateDraftAnswer(item, { direct = false, chatApiKey = null } = {}) {
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
            const scored = await getVectorStore().similaritySearchWithScore(
                item.question,
                8,
                materialFilter
            );
            docs = scored.map(([doc]) => doc);
            item.confidence = scored.length > 0 ? +scored[0][1].toFixed(3) : null;
        } else {
            docs = await getRetriever().invoke(item.question);
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

        const buildChain = (model, apiKey) =>
            RunnableSequence.from([
                direct ? directPromptTemplate : promptTemplate,
                buildKeyedChatModel(model, apiKey),
                new StringOutputParser()
            ]);

        // Ordered attempts: [user key + primary] → [shared + primary] →
        // [shared + fallback]. A healthy user key short-circuits at step
        // one; a cooled/invalid one is skipped before any call (see
        // checkUserKeyHealth). Non-quota errors stop the ladder — replaying
        // a bad request on another model just burns quota twice.
        // Direct (follow-up) answers pin to the light model — threads need
        // speed and quota headroom, not frontier reasoning. Funding still
        // prefers the asker's key, then shared.
        const baseModel = direct ? LIGHT_MODEL : PRIMARY_MODEL;
        const attempts = [];
        if (chatApiKey && checkUserKeyHealth(chatApiKey) === 'ok') {
            attempts.push({ model: baseModel, apiKey: chatApiKey, fund: 'user' });
        }
        attempts.push({ model: baseModel, apiKey: null, fund: 'shared' });
        if (!direct && FALLBACK_MODEL !== PRIMARY_MODEL) {
            attempts.push({ model: FALLBACK_MODEL, apiKey: null, fund: 'shared' });
        }
        // Drop exact duplicates (e.g. light == fallback) so no call fires
        // twice for the same rung.
        const seen = new Set();
        const ladder = attempts.filter((attempt) => {
            const key = `${attempt.model}|${attempt.fund}|${attempt.apiKey ? 'u' : 's'}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        let rawAnswer;
        let fundedBy = 'shared';
        let userKeyStatus = chatApiKey ? checkUserKeyHealth(chatApiKey) : null;
        if (userKeyStatus !== 'ok') userKeyStatus = null;
        let lastError = null;
        for (const attempt of ladder) {
            try {
                rawAnswer = await buildChain(attempt.model, attempt.apiKey).invoke({
                    context,
                    question: item.question,
                });
                fundedBy = attempt.fund;
                if (attempt.fund === 'user' && chatApiKey) {
                    clearUserKeyHealth(chatApiKey);
                    userKeyStatus = 'ok';
                }
                lastError = null;
                break;
            } catch (attemptError) {
                lastError = attemptError;
                if (attempt.fund === 'user' && chatApiKey) {
                    if (isInvalidKeyError(attemptError)) {
                        noteUserKeyFailure(chatApiKey, 'invalid');
                        userKeyStatus = 'invalid';
                    } else if (isQuotaError(attemptError)) {
                        noteUserKeyFailure(chatApiKey, 'quota');
                        userKeyStatus = 'quota';
                    } else {
                        userKeyStatus = 'error';
                    }
                    console.error(`User-key attempt failed for ${item._id} (${userKeyStatus}), falling back to shared.`);
                    continue;
                }
                if (attempt.fund === 'shared') {
                    if (isQuotaError(attemptError)) {
                        recordSharedQuotaFailure();
                        console.error(
                            `Shared ${attempt.model} quota-hit for ${item._id}, trying next rung.`
                        );
                        continue;
                    }
                    break;
                }
            }
        }
        if (lastError) throw lastError;

        const { answer: draftAnswer, sources } = splitAnswerAndSources(rawAnswer);

        item.draftAnswer = draftAnswer;
        item.sources = sources;
        // A success clears any earlier failure record (e.g. after retry).
        item.generationError = null;
        await item.save();
        return { draftAnswer, sources, fundedBy, userKeyStatus };
    } catch (error) {
        console.error(`Error generating draft answer for ${item._id}:`, error);
        // Record the failure ON the item (instead of just logging): the
        // queue surfaces draftless pending items with a Retry action, so
        // a dead generation can never strand a question silently again.
        try {
            item.generationError = String(error?.message || error).slice(0, 500);
            item.generationAttempts = (item.generationAttempts || 0) + 1;
            await item.save();
        } catch (saveError) {
            console.error(`Failed to record generation error for ${item._id}:`, saveError.message);
        }
    }
}

export { generateDraftAnswer };
