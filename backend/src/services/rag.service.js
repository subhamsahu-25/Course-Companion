// backend/src/services/rag.service.js
const ragRequest = async (endpoint, options = {}) => {
   const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL; // read at call-time, not import-time

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

const submitQuestion = (studentId, question) =>
   ragRequest("/submit-question", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, question }),
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

export { submitQuestion, getReviewQueue, approveAnswer, rejectAnswer, getMyAnswer };