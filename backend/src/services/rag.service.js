// backend/src/services/rag.service.js — update submitQuestion, add getStats
const ragRequest = async (endpoint, options = {}) => {
   const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL;

   const response = await fetch(`${RAG_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(data.error || "RAG service error");
   }
   return data;
};

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

export { submitQuestion, getReviewQueue, approveAnswer, rejectAnswer, getMyAnswer, getMyAnswers, getStats };