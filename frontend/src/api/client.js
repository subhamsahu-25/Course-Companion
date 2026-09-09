// frontend/src/api/client.js
//
// One file, one pattern, for every backend call the app makes.
// Nothing else in the app should call `fetch` directly — this keeps the
// request/response shape, error handling, and auth cookie handling in
// exactly one place instead of drifting across files.

const BASE_URL = import.meta.env.VITE_API_BASE_URL

async function request(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // sends/receives the auth cookie set at login
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong')
  }

  return data
}

// ---- Auth ----------------------------------------------------------------
export const login = (identifier, password) => {
  const isEmail = identifier.includes('@')
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: isEmail ? identifier : undefined,
      username: isEmail ? undefined : identifier,
      password,
    }),
  })
}

export const register = (email, username, password, role) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, role }),
  })

export const logout = () => request('/auth/logout', { method: 'POST' })

export const getCurrentUser = () =>
  request('/auth/current-user', { method: 'POST' })

// ---- Courses ---------------------------------------------------------------

export const getCourses = () => request('/courses')

export const getCourseById = (courseId) => request(`/courses/${courseId}`)

export const createCourse = (title, description) =>
  request('/courses', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  })

export const updateCourse = (courseId, updates) =>
  request(`/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })

export const deleteCourse = (courseId) =>
  request(`/courses/${courseId}`, { method: 'DELETE' })

// Joins the caller into a course via its 5-digit code. Which list they
// land in (students vs tas) is decided server-side from their own account
// role — this call doesn't need to know or pass that.
export const joinCourse = (code) =>
  request('/courses/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })

// ---- Modules ---------------------------------------------------------------

export const getModulesByCourse = (courseId) =>
  request(`/modules/course/${courseId}`)

export const createModule = (title, courseId) =>
  request('/modules', {
    method: 'POST',
    body: JSON.stringify({ title, course: courseId }),
  })

export const deleteModule = (moduleId) =>
  request(`/modules/${moduleId}`, { method: 'DELETE' })

// ---- Documents ---------------------------------------------------------------

export const getDocumentsByModule = (moduleId) =>
  request(`/documents/module/${moduleId}`)

export const deleteDocument = (documentId) =>
  request(`/documents/${documentId}`, { method: 'DELETE' })

export const getDocumentFileUrl = (documentId) =>
  `${BASE_URL}/documents/${documentId}/file`

// File uploads need FormData, not JSON — kept separate since headers differ
// (no Content-Type here; the browser sets the multipart boundary itself).
export const uploadDocument = async (moduleId, file, title) => {
  const formData = new FormData()
  formData.append('file', file)
  if (title) formData.append('title', title)

  const res = await fetch(`${BASE_URL}/documents/module/${moduleId}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Upload failed')
  }
  return data
}

// ---- Q&A (RAG-backed question/review flow) ---------------------------------

export const askQuestion = (question, moduleId) =>
  request('/qa/ask', {
    method: 'POST',
    body: JSON.stringify({ question, moduleId }),
  })

export const getMyAnswer = (requestId) => request(`/qa/my-answer/${requestId}`)

export const getMyAnswers = () => request('/qa/my-answers')

export const getStats = () => request('/qa/stats')

export const getReviewQueue = () => request('/qa/queue')

export const getModuleHistory = (moduleId) => request(`/qa/history/${moduleId}`)

export const approveAnswer = (id, editedAnswer) =>
  request(`/qa/queue/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ editedAnswer }),
  })

export const rejectAnswer = (id, note) =>
  request(`/qa/queue/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
