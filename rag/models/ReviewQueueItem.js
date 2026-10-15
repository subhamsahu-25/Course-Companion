import mongoose from 'mongoose';

const reviewQueueItemSchema = new mongoose.Schema(
    {
        studentId: { type: String, default: null },
        // Persisted so history can be scoped per course/module later —
        // previously this only lived transiently in the request body used
        // for retrieval filtering, so /my-answers had no way to tell which
        // module a given question was even about.
        moduleId: { type: String, default: null, index: true },
        // Course scope, stored alongside moduleId so retrieval, history,
        // and purge can all be isolated per course — moduleIds alone can't
        // do that (two courses can hold same-titled modules, and module
        // lookups live in the backend, not here).
        courseId: { type: String, default: null, index: true },
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
        // TA star rating, 1 (very poor) to 5 (very good). Null means the TA
        // left it unattended — deliberately NOT defaulted to 0, so
        // "unrated" stays distinguishable from "rated poorly".
        rating: { type: Number, default: null, min: 1, max: 5 },
        // Retrieval confidence: cosine score of the best material chunk
        // behind this draft (0–1, null when nothing was retrieved). Lets
        // the TA queue triage shakiest-first instead of oldest-first.
        confidence: { type: Number, default: null },
        // Generation failure record: message + attempt count. A failed
        // draft stays pending with an empty draftAnswer — historically
        // invisible to the queue forever. Now it surfaces with a Retry.
        generationError: { type: String, default: null },
        generationAttempts: { type: Number, default: 0 },
        // True when the TA edited the draft before approving — lets the
        // feedback loop (and future analytics) tell "approved as-is" apart
        // from "approved with corrections".
        wasEdited: { type: Boolean, default: false },
        // Follow-up thread: the root question's item id. Follow-ups share
        // their thread's resolved history as extra context, so students
        // don't restate everything per question.
        threadId: { type: String, default: null, index: true },
        // TA userIds that marked this question important. A checkbox per
        // card, togglable — when marks from distinct TAs reach
        // IMPORTANT_THRESHOLD, the question surfaces on the instructor
        // portal ("important questions" below the TA roster).
        importantBy: { type: [String], default: [] },
        // Normalized question text (lowercased, punctuation/whitespace
        // collapsed) for exact repeat detection — the first leg of
        // instant answers. Stored at creation so repeats match with an
        // indexed query instead of embedding every submission.
        normalizedQuestion: { type: String, default: null, index: true },
        // True when this item never saw the TA queue: the question matched
        // a verified answer closely enough to serve instantly. servedFrom
        // points at the approved item it was answered from.
        autoServed: { type: Boolean, default: false },
        servedFrom: { type: String, default: null },
        // Who resolved the review (approve or reject) and when — powers
        // the instructor's per-TA "questions reviewed" counts. Null for
        // items resolved before this existed.
        reviewedBy: { type: String, default: null },
        reviewedAt: { type: Date, default: null },
        // Traceable citations: the actual documents placed in the LLM's
        // context for this question (source file, page, line range), NOT
        // the model's self-reported SOURCES line. Powers the "which PDF,
        // which page, which line" tags in history views.
        citations: {
            type: [
                {
                    source: { type: String, default: "Unknown source" },
                    page: { type: Number, default: null },
                    line: { type: Number, default: null },
                    lineEnd: { type: Number, default: null },
                    golden: { type: Boolean, default: false },
                },
            ],
            default: [],
        },
    },
    { timestamps: true }
);
reviewQueueItemSchema.index({ studentId: 1, createdAt: -1 });

const ReviewQueueItem = mongoose.model("ReviewQueueItem", reviewQueueItemSchema);

export default ReviewQueueItem;
