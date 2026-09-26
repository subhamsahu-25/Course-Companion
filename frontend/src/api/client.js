// frontend/src/api/client.js
//
// One file, one pattern, for every backend call the app makes.
// Nothing else in the app should call `fetch` directly — this keeps the
// request/response shape, error handling, and auth cookie handling in
// exactly one place instead of drifting across files.

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(endpoint, options = {}, _retried = false) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // sends/receives the auth cookie set at login
  });

  const data = await res.json().catch(() => ({}));

  // Silent token refresh: if the access cookie expired mid-session, try one
  // refresh + retry before surfacing a 401. Auth endpoints themselves are
  // excluded (a 401 from /auth/login is a real "wrong password", not an
  // expired session), and we retry at most once to avoid loops.
  if (res.status === 401 && !_retried && !endpoint.startsWith('/auth/')) {
    try {
      await request('/auth/refresh-token', { method: 'POST' }, true);
      return request(endpoint, options, true);
    } catch {
      // Refresh failed too (refresh cookie gone/expired) — fall through
      // and throw the ORIGINAL error below, not the refresh one.
    }
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong');
    // Surfaced (not string-matched) so pages can branch on status —
    // e.g. Login shows "resend verification email" only on a 403.
    err.statusCode = res.status;
    err.errors = data.errors || [];
    throw err;
  }

  return data;
}

// ---- Auth ----------------------------------------------------------------
export const login = (identifier, password) => {
  const isEmail = identifier.includes('@');
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: isEmail ? identifier : undefined,
      username: isEmail ? undefined : identifier,
      password,
    }),
  });
};

export const register = (email, username, password, role, rollNo, fullName) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, role, rollNo, fullName }),
  });

export const logout = () => request('/auth/logout', { method: 'POST' });

export const refreshAccessToken = () =>
  request('/auth/refresh-token', { method: 'POST' });

export const resendEmailVerification = (identifier) => {
  const isEmail = identifier.includes('@');
  return request('/auth/resend-email-verification', {
    method: 'POST',
    body: JSON.stringify({
      email: isEmail ? identifier : undefined,
      username: isEmail ? undefined : identifier,
    }),
  });
};

export const verifyEmailToken = (token) =>
  request(`/auth/verify-email/${token}`);

export const forgotPassword = (email) =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token, newPassword) =>
  request(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });

export const changePassword = (oldPassword, newPassword) =>
  request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });

export const getCurrentUser = () =>
  request('/auth/current-user', { method: 'POST' });

export const updateProfile = (fullName) =>
  request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ fullName }),
  });

// Avatar upload needs FormData (no JSON Content-Type); same one-retry
// silent refresh on 401 as document uploads.
export const uploadAvatar = async (file, _retried = false) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch(`${BASE_URL}/auth/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && !_retried) {
    try {
      await refreshAccessToken();
      return uploadAvatar(file, true);
    } catch {
      // fall through to the original error below
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Avatar upload failed');
    err.statusCode = res.status;
    err.errors = data.errors || [];
    throw err;
  }
  return data;
};

// ---- Courses ---------------------------------------------------------------

export const getCourses = () => request('/courses');

export const getCourseById = (courseId) => request(`/courses/${courseId}`);

export const createCourse = (title, description) =>
  request('/courses', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });

export const updateCourse = (courseId, updates) =>
  request(`/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

export const deleteCourse = (courseId) =>
  request(`/courses/${courseId}`, { method: 'DELETE' });

export const removeCourseMember = (courseId, userId) =>
  request(`/courses/${courseId}/members/${userId}`, { method: 'DELETE' });

// Joins the caller into a course via its 5-digit code. Which list they
// land in (students vs tas) is decided server-side from their own account
// role — this call doesn't need to know or pass that.
export const joinCourse = (code) =>
  request('/courses/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

// ---- Modules ---------------------------------------------------------------

export const getModulesByCourse = (courseId) =>
  request(`/modules/course/${courseId}`);

export const createModule = (title, courseId) =>
  request('/modules', {
    method: 'POST',
    body: JSON.stringify({ title, course: courseId }),
  });

export const deleteModule = (moduleId) =>
  request(`/modules/${moduleId}`, { method: 'DELETE' });

// ---- Documents ---------------------------------------------------------------

export const getDocumentsByModule = (moduleId) =>
  request(`/documents/module/${moduleId}`);

export const deleteDocument = (documentId) =>
  request(`/documents/${documentId}`, { method: 'DELETE' });

export const getDocumentFileUrl = (documentId) =>
  `${BASE_URL}/documents/${documentId}/file`;

// File uploads need FormData, not JSON — kept separate since headers differ
// (no Content-Type here; the browser sets the multipart boundary itself).
// XHR variant so callers get real upload progress events (fetch can't do
// upload progress). Same silent-refresh deal: one retry after refresh on
// a 401. onProgress receives { phase: 'uploading', loaded, total }.
export const uploadDocumentWithProgress = (
  moduleId,
  file,
  title,
  onProgress,
  _retried = false,
) =>
  new Promise((resolve, reject) => {
    const send = (retried) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/documents/module/${moduleId}`);
      xhr.withCredentials = true;
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({
              phase: 'uploading',
              loaded: e.loaded,
              total: e.total,
            });
          }
        };
      }
      xhr.onload = async () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON body — handled below via status check
        }
        if (xhr.status === 401 && !retried) {
          try {
            await refreshAccessToken();
          } catch {
            const err = new Error(data.message || 'Upload failed');
            err.statusCode = 401;
            reject(err);
            return;
          }
          send(true);
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const err = new Error(data.message || 'Upload failed');
          err.statusCode = xhr.status;
          err.errors = data.errors || [];
          reject(err);
          return;
        }
        resolve(data);
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      xhr.send(formData);
    };
    send(_retried);
  });

// Same silent-refresh deal as request(): one retry after refresh on a 401.
export const uploadDocument = async (
  moduleId,
  file,
  title,
  _retried = false,
) => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);

  const res = await fetch(`${BASE_URL}/documents/module/${moduleId}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && !_retried) {
    try {
      await refreshAccessToken();
      return uploadDocument(moduleId, file, title, true);
    } catch {
      // fall through to the original error below
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Upload failed');
    err.statusCode = res.status;
    err.errors = data.errors || [];
    throw err;
  }
  return data;
};

// ---- Q&A (RAG-backed question/review flow) ---------------------------------

export const askQuestion = (question, moduleId) =>
  request('/qa/ask', {
    method: 'POST',
    body: JSON.stringify({ question, moduleId }),
  });

export const getMyAnswer = (requestId) => request(`/qa/my-answer/${requestId}`);

export const getMyAnswers = () => request('/qa/my-answers');

export const getStats = () => request('/qa/stats');

export const getReviewQueue = () => request('/qa/queue');

export const getModuleHistory = (moduleId) =>
  request(`/qa/history/${moduleId}`);

export const approveAnswer = (id, editedAnswer) =>
  request(`/qa/queue/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ editedAnswer }),
  });

export const rejectAnswer = (id, note) =>
  request(`/qa/queue/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
