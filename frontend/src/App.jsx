// frontend/src/App.jsx
import { useEffect, useState } from 'react';

import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import RoleLayout from './layouts/RoleLayout.jsx';
import { getCurrentUser, logout as logoutRequest } from './api/client.js';

import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentCourses from './pages/student/Courses.jsx';
import StudentModules from './pages/student/Modules.jsx';
import StudentAsk from './pages/student/Ask.jsx';
import StudentHistory from './pages/student/History.jsx'; // add this

import ReviewQueue from './pages/ta/ReviewQueue.jsx';
import TaHistory from './pages/ta/History.jsx';

import AdminCourses from './pages/admin/Courses.jsx';
import AdminModules from './pages/admin/Modules.jsx';
import AdminUpload from './pages/admin/Upload.jsx';

import JoinCourse from './pages/JoinCourse.jsx';

function defaultPageForRole(role) {
  if (role === 'ta') return 'ta-review';
  if (role === 'admin' || role === 'instructor') return 'admin-courses';
  return 'student-dashboard';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  // 'checking' avoids flashing the login screen before we know whether an
  // existing session cookie is still valid.
  const [authStatus, setAuthStatus] = useState('checking');
  // Which auth screen to show while logged out — 'login' or 'signup'.
  const [authView, setAuthView] = useState('login');

  // Navigation context carried between pages — e.g. which course was
  // clicked on the Courses page, so Modules knows what to load.
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

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    setAuthStatus('authenticated');
    setCurrentPage(defaultPageForRole(loggedInUser.role));
  }

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // even if the network call fails, still clear local state so the
      // user isn't stuck on a page that assumes they're logged in
    }
    setUser(null);
    setAuthStatus('anonymous');
    setAuthView('login');
    setCurrentPage('login');
  }

  // `params` can carry { courseId } and/or { moduleId } alongside a page
  // change, so a page further down the flow (Modules, Ask) knows which
  // course/module was clicked on the page before it.
  function changePage(page, params = {}) {
    if (params.courseId !== undefined) setSelectedCourseId(params.courseId);
    if (params.moduleId !== undefined) setSelectedModuleId(params.moduleId);
    setCurrentPage(page);
  }

  function getPage() {
    switch (currentPage) {
      case 'student-dashboard':
        return <StudentDashboard onPageChange={changePage} />;

      case 'student-courses':
        return <StudentCourses onPageChange={changePage} />;

      case 'student-modules':
        return (
          <StudentModules
            courseId={selectedCourseId}
            onPageChange={changePage}
          />
        );

      case 'student-ask':
        return <StudentAsk initialModuleId={selectedModuleId} />;

      case 'student-history':
        return <StudentHistory onPageChange={changePage} />;

      case 'student-join':
        return (
          <JoinCourse onPageChange={changePage} redirectTo="student-courses" />
        );

      case 'ta-review':
        return <ReviewQueue onPageChange={changePage} />;

      case 'ta-history':
        return <TaHistory onPageChange={changePage} />;

      case 'ta-join':
        return <JoinCourse onPageChange={changePage} redirectTo="ta-review" />;

      case 'admin-courses':
        return <AdminCourses onPageChange={changePage} />;

      case 'admin-modules':
        return (
          <AdminModules courseId={selectedCourseId} onPageChange={changePage} />
        );

      case 'admin-upload':
        return <AdminUpload initialModuleId={selectedModuleId} />;

      default:
        return <div className="rounded-lg bg-white p-6">Page not found</div>;
    }
  }

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-[#457B9D]">
        Loading…
      </div>
    );
  }

  if (authStatus === 'anonymous' || !user) {
    if (authView === 'signup') {
      return (
        <Signup
          onSignupSuccess={() => setAuthView('login')}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }

    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignup={() => setAuthView('signup')}
      />
    );
  }

  return (
    <RoleLayout
      role={user.role}
      currentPage={currentPage}
      onPageChange={changePage}
      onLogout={handleLogout}
    >
      {getPage()}
    </RoleLayout>
  );
}
