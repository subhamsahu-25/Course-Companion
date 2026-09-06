// frontend/src/api/courses.js
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

export const getCourses = () => request("/courses");
export const getCourseById = (courseId) => request(`/courses/${courseId}`);

export const createCourse = (title, description) =>
   request("/courses", {
      method: "POST",
      body: JSON.stringify({ title, description }),
   });

export const deleteCourse = (courseId) =>
   request(`/courses/${courseId}`, {
      method: "DELETE",
   });

export const getModulesByCourse = (courseId) => request(`/modules/course/${courseId}`);

// frontend/src/api/courses.js — add this one function
export const updateCourse = (courseId, updates) =>
   request(`/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
   });

export const createModule = (title, courseId) =>
   request("/modules", {
      method: "POST",
      body: JSON.stringify({ title, course: courseId }),
   });

export const getDocumentsByModule = (moduleId) => request(`/documents/module/${moduleId}`);

export const openDocumentFile = async (documentId) => {
   const res = await fetch(`${BASE_URL}/documents/${documentId}/file`, {
      credentials: "include",
   });

   if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Could not open file");
   }

   const blob = await res.blob();
   const url = URL.createObjectURL(blob);
   window.open(url, "_blank", "noopener,noreferrer");
};

export const uploadDocument = async (moduleId, file, title) => {
   const formData = new FormData();
   formData.append("file", file);
   if (title) formData.append("title", title);

   const res = await fetch(`${BASE_URL}/documents/module/${moduleId}`, {
      method: "POST",
      credentials: "include",
      body: formData,
   });

   const data = await res.json();
   if (!res.ok) {
      throw new Error(data.message || "Upload failed");
   }
   return data;
};