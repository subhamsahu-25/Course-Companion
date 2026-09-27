// backend/src/services/rag.service.js — update submitQuestion, add getStats
const ragRequest = async (endpoint, options = {}) => {
   // A trailing slash in RAG_SERVICE_URL turns "/ingest" into "//ingest",
   // which Express 5 answers with an HTML 404 — strip it once, here.
   const RAG_SERVICE_URL = (process.env.RAG_SERVICE_URL || "").replace(
      /\/+$/,
      ""
   );

   let response;
   try {
      response = await fetch(`${RAG_SERVICE_URL}${endpoint}`, {
         ...options,
         headers: {
            "Content-Type": "application/json",
            "x-service-key": process.env.RAG_SERVICE_KEY,
            ...options.headers,
         },
      });
   } catch (err) {
      throw new Error(`RAG service unreachable: ${err.message}`);
   }

   // Asleep/crashed RAG answers via Railway's proxy with an HTML error
   // page — parsing that as JSON produced the infamous
   // "Unexpected token '<'" 500s. Name the real cause instead.
   const contentType = response.headers.get("content-type") || "";
   if (contentType.includes("text/html")) {
      throw new Error(
         `RAG service unavailable (HTTP ${response.status}) — it may be waking from sleep; retry in a minute.`
      );
   }

   const data = await response.json().catch(() => ({}));
   if (!response.ok) {
      throw new Error(data.error || "RAG service error");
   }
   return data;
};

// Sends an uploaded file to the rag service to be chunked, embedded, and
// added to the vector store — this is the step that was missing entirely
// before: uploading a document saved the file but never indexed it.
const ingestDocument = (documentId, moduleId, courseId, filename, fileBase64) =>
   ragRequest("/ingest", {
      method: "POST",
      body: JSON.stringify({ documentId, moduleId, courseId, filename, fileBase64 }),
   });

// Removes every vector in a course/module scope — documents plus
// TA-verified ("golden") answers, which aren't Document records but carry
// the same scope tags. Used on course hard-delete.
const purgeVectors = ({ moduleIds, courseId } = {}) =>
   ragRequest("/ingest/purge", {
      method: "POST",
      body: JSON.stringify({ moduleIds, courseId }),
   });

// Best-effort cleanup so a deleted document's chunks stop showing up in
// answers. Callers should not fail the delete just because this fails.
const removeIngestedDocument = (documentId) =>
   ragRequest(`/ingest/${documentId}`, { method: "DELETE" });

const submitQuestion = (studentId, question, moduleId, courseId, threadId) =>
   ragRequest("/submit-question", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, question, module_id: moduleId, course_id: courseId, thread_id: threadId }),
   });

const getReviewQueue = () => ragRequest("/review-queue");

const approveAnswer = (id, editedAnswer, rating, reviewedBy) =>
   ragRequest(`/review-queue/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ editedAnswer, rating, reviewedBy }),
   });

const rejectAnswer = (id, note, reviewedBy) =>
   ragRequest(`/review-queue/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note, reviewedBy }),
   });

// Toggles the calling TA's important mark on a question (checkbox).
const toggleImportant = (id, taId) =>
   ragRequest(`/review-queue/${id}/important`, {
      method: "POST",
      body: JSON.stringify({ taId }),
   });

// Questions in a course with enough TA important marks to highlight.
const getImportantQuestions = (courseId) =>
   ragRequest(`/review-queue/important?courseId=${encodeURIComponent(courseId)}`);

// Per-course activity: asked counts per student, resolved counts per TA.
const getCourseQaStats = (courseId) =>
   ragRequest(`/review-queue/course-stats?courseId=${encodeURIComponent(courseId)}`);

// Live related verified answers for the ask form (powers #8 + feeds the
// auto-serve corpus check on the client before submit).
const getRelatedQuestions = (moduleId, courseId, q) =>
   ragRequest(
      `/related-questions?moduleId=${encodeURIComponent(moduleId)}&courseId=${encodeURIComponent(courseId)}&q=${encodeURIComponent(q)}`
   );

const getMyAnswer = (id) => ragRequest(`/my-answer/${id}`);

const getMyAnswers = (studentId, includeThreads = false) =>
   ragRequest(`/my-answers/${studentId}${includeThreads ? "?includeThreads=1" : ""}`);

const getStats = (studentId) => ragRequest(`/stats/${studentId}`);

// Purges every Q&A history item tied to any of the given modules. Used
// when a course is hard-deleted — the rag service owns ReviewQueueItem in
// its own MongoDB connection, so the backend can't delete these rows
// directly and has to ask the rag service to do it.
const purgeReviewQueueForModules = (moduleIds) =>
   ragRequest("/review-queue/purge", {
      method: "POST",
      body: JSON.stringify({ moduleIds }),
   });

// Purges ONE member's Q&A history within the given modules. Used when a
// student/TA is removed from a course — scoped to their studentId so
// everyone else's history survives (unlike purgeReviewQueueForModules).
const purgeMemberHistory = (studentId, moduleIds) =>
   ragRequest("/review-queue/purge-member", {
      method: "POST",
      body: JSON.stringify({ studentId, moduleIds }),
   });

// Every question ever asked in a module, any status — used by the TA
// "History" view, unlike /review-queue which only ever returns pending
// items.
const getModuleHistory = (moduleId) => ragRequest(`/module-history/${moduleId}`);

export {
   submitQuestion,
   getReviewQueue,
   approveAnswer,
   rejectAnswer,
   toggleImportant,
   getImportantQuestions,
   getCourseQaStats,
   getRelatedQuestions,
   getMyAnswer,
   getMyAnswers,
   getStats,
   ingestDocument,
   removeIngestedDocument,
   purgeVectors,
   purgeReviewQueueForModules,
   purgeMemberHistory,
   getModuleHistory,
};