// frontend/src/api/auth.js
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

export const loginRequest = (email, username, password) =>
   request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
   });

export const logoutRequest = () =>
   request("/auth/logout", { method: "POST" });

export const getCurrentUserRequest = () =>
   request("/auth/current-user", { method: "POST" });