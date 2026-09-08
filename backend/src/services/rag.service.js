// backend/src/services/rag.service.js — update submitQuestion, add getStats
const ragRequest = async (endpoint, options = {}) => {
   const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL;

   const response = await fetch(`${RAG_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
         "Content-Type": "application/json",
         "x-service-key": process.env.RAG_SERVICE_KEY,
         ...options.headers,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(data.error || "RAG service error");
   }
   return data;
};

// Sends an uploaded file to the rag service to be chunked, embedded, and
// added to the vector store — this is the step that was missing entirely
// before: uploading a document saved the file but never indexed it.
const ingestDocument = (documentId, moduleId, filename, fileBase64) =>
   ragRequest("/ingest", {
      method: "POST",
      body: JSON.stringify({ documentId, moduleId, filename, fileBase64 }),
   });

// Best-effort cleanup so a deleted document's chunks stop showing up in
// answers. Callers should not fail the delete just because this fails.
const removeIngestedDocument = (documentId) =>
   ragRequest(`/ingest/${documentId}`, { method: "DELETE" });

const submitQuestion = (studentId, question, moduleId) =>
   ragRequest("/submit-question", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, question, module_id: moduleId }),
   });

const getReviewQueue = () => ragRequest("/review-queue");

const approveAnswer = (id, editedAnswer) =>
   ragRequest(`/review-queue/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ editedAnswer }),
   });

const rejectAnswer = (id, note) =>
   ragRequest(`/review-queue/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
   });

const getMyAnswer = (id) => ragRequest(`/my-answer/${id}`);

const getMyAnswers = (studentId) => ragRequest(`/my-answers/${studentId}`);

const getStats = (studentId) => ragRequest(`/stats/${studentId}`);

export { submitQuestion, getReviewQueue, approveAnswer, rejectAnswer, getMyAnswer, getMyAnswers, getStats, ingestDocument, removeIngestedDocument };