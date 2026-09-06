// frontend/src/api/qa.js — update askQuestion to accept moduleId, add getStats
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const request = async (endpoint, options = {}) => {
   const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      credentials: "include",
   });

   const data = await res.json();
   if (!res.ok) {
      throw new Error(data.message || "Something went wrong");
   }
   return data;
};

export const askQuestion = (question, moduleId) =>
   request("/qa/ask", { method: "POST", body: JSON.stringify({ question, moduleId }) });

export const getMyAnswer = (id) => request(`/qa/my-answer/${id}`);
export const getMyAnswers = () => request("/qa/my-answers");
export const getStats = () => request("/qa/stats");

export const getReviewQueue = () => request("/qa/queue");

export const approveAnswer = (id, editedAnswer) =>
   request(`/qa/queue/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ editedAnswer }),
   });

export const rejectAnswer = (id, note) =>
   request(`/qa/queue/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
   });