// frontend/src/App.jsx
import { useEffect, useState } from 'react';

import Login from './pages/Login.jsx';
import RoleLayout from './layouts/RoleLayout.jsx';
import { getCurrentUser, logoutUser } from './api/client.js';

import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentCourses from './pages/student/Courses.jsx';
import StudentModules from './pages/student/Modules.jsx';
import StudentAsk from './pages/student/Ask.jsx';

import ReviewQueue from './pages/ta/ReviewQueue.jsx';

import AdminCourses from './pages/admin/Courses.jsx';
import AdminModules from './pages/admin/Modules.jsx';
import AdminUpload from './pages/admin/Upload.jsx';

// Instructor and admin currently share the same course-management screens.
function defaultPageForRole(role) {
  if (role === 'ta') return 'ta-review';
  if (role === 'admin' || role === 'instructor') return 'admin-courses';
  return 'student-dashboard';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [authStatus, setAuthStatus] = useState('checking');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((res) => {
        if (cancelled) return;
        setUser(res.data);
        setCurrentPage(defaultPageForRole(res.data.role));
        setAuthStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function login(loggedInUser) {
    setUser(loggedInUser);
    setAuthStatus('authenticated');
    setCurrentPage(defaultPageForRole(loggedInUser.role));
  }

  async function logout() {
    try {
      await logoutUser();
    } catch {
      // even if the network call fails, still clear local state so the
      // user isn't stuck on a page that assumes they're logged in
    }
    setUser(null);
    setAuthStatus('anonymous');
    setCurrentPage('login');
  }

  // params can carry { courseId } and/or { moduleId } alongside a page
  // change, so pages further down the navigation (Modules, Ask) know
  // which course/module was clicked on the page before them.
  function changePage(page, params = {}) {
    if (params.courseId !== undefined) setSelectedCourseId(params.courseId);
    if (params.moduleId !== undefined) setSelectedModuleId(params.moduleId);
    setCurrentPage(page);
  }

  function getPage() {
    if (currentPage === 'student-dashboard') {
      return <StudentDashboard onPageChange={changePage} />;
    }

    if (currentPage === 'student-courses') {
      return <StudentCourses onPageChange={changePage} />;
    }

    if (currentPage === 'student-modules') {
      return (
        <StudentModules courseId={selectedCourseId} onPageChange={changePage} />
      );
    }

    if (currentPage === 'student-ask') {
      return <StudentAsk initialModuleId={selectedModuleId} />;
    }

    if (currentPage === 'ta-review') {
      return <ReviewQueue />;
    }

    if (currentPage === 'admin-courses') {
      return <AdminCourses onPageChange={changePage} />;
    }

    if (currentPage === 'admin-modules') {
      return (
        <AdminModules courseId={selectedCourseId} onPageChange={changePage} />
      );
    }

    if (currentPage === 'admin-upload') {
      return <AdminUpload />;
    }

    return <div className="rounded-lg bg-white p-6">Page not found</div>;
  }

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-[#457B9D]">
        Loading…
      </div>
    );
  }

  if (authStatus === 'anonymous' || !user) {
    return <Login onLogin={login} />;
  }

  return (
    <RoleLayout
      role={user.role}
      currentPage={currentPage}
      onPageChange={changePage}
      onLogout={logout}
    >
      {getPage()}
    </RoleLayout>
  );
}
