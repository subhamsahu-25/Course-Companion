// frontend/src/api/client.js
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const request = async (endpoint, options = {}) => {
   const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
         "Content-Type": "application/json",
         ...options.headers,
      },
      credentials: "include", // sends/receives auth cookies cross-origin
   });

   const data = await res.json();

   if (!res.ok) {
      throw new Error(data.message || "Something went wrong");
   }

   return data;
};

export const login = (email, password) =>
   request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const getModules = (courseId) =>
   request(`/modules/course/${courseId}`);

export const getQuestionFeed = (params = "") =>
   request(`/questions/feed${params}`);

// add more as needed, following this same pattern