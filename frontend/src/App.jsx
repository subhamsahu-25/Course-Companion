// frontend/src/App.jsx
import { useEffect, useState } from 'react';

import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Account from './pages/Account.jsx';
import RoleLayout from './layouts/RoleLayout.jsx';
import {
  getCurrentUser,
  refreshAccessToken,
  logout as logoutRequest,
  setGeminiKey as savePendingGeminiKey,
  getGeminiKeyStatus,
} from './api/client.js';

import StudentDashboard from './pages/student/Dashboard.jsx';
import StudentCourses from './pages/student/Courses.jsx';
import StudentModules from './pages/student/Modules.jsx';
import StudentAsk from './pages/student/Ask.jsx';
import StudentHistory from './pages/student/History.jsx'; // add this

import ReviewQueue from './pages/ta/ReviewQueue.jsx';
import TaHistory from './pages/ta/History.jsx';

import AdminCourses from './pages/admin/Courses.jsx';
import AdminModules from './pages/admin/Modules.jsx';
import AdminRoster from './pages/admin/Roster.jsx';
import AdminUpload from './pages/admin/Upload.jsx';

import JoinCourse from './pages/JoinCourse.jsx';
import Showcase from './pages/Showcase.jsx';
import { LoadingState } from './components/ui/primitives.jsx';
import {
  setStoredUid,
  getStoredUid,
  clearUserCache,
} from './utils/cache.js';

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
  // Which auth screen to show while logged out — 'login', 'signup',
  // 'forgot', 'reset', or 'verify'.
  const [authView, setAuthView] = useState('login');
  // One-shot banner on the login screen (e.g. "check your email" after
  // signup or after a password reset) — cleared on successful login.
  const [authNotice, setAuthNotice] = useState(null);
  // Tokens arriving via email links: backend mails link to
  // <frontend>/?resetToken=... and <frontend>/?verifyToken=... (query
  // params, so no SPA route config is needed on Vercel).
  const [resetToken, setResetToken] = useState(null);
  const [verifyToken, setVerifyToken] = useState(null);

  // Navigation context carried between pages — e.g. which course was
  // clicked on the Courses page, so Modules knows what to load.
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  // Follow-up thread context: set when jumping History → Ask via "Follow
  // up", so the new question joins the same thread instead of starting
  // over. { threadId, question, answer, courseId, moduleId } | null.
  const [followUp, setFollowUp] = useState(null);
  // History context: course/module to pre-select when landing on History
  // with context (Back-to-history, "view in history"). Set ONLY on such
  // jumps — direct sidebar visits pass nothing and start blank.
  const [historyContext, setHistoryContext] = useState(null);
  // Key prompt: shown after every sign-in while the account has no key.
  // TAs excluded (no key UI exists for that role). Dismissal lasts the
  // session only — next sign-in asks again until a key is saved.
  const [keyPrompt, setKeyPrompt] = useState(false);
  async function maybeKeyPrompt(user) {
    if (!user || user.role === 'ta') return;
    try {
      const res = await getGeminiKeyStatus();
      if (!res.data?.present) setKeyPrompt(true);
    } catch {
      // Status check must never block or break sign-in.
    }
  }
  // Ask entry context: the module the student came from (if any). The
  // shared selectedModuleId goes stale across sidebar visits, so the
  // Back-to-modules button keys off this explicit value instead.
  const [askEntryModule, setAskEntryModule] = useState(null);
  // Upload entry context, same idea for instructors: only a jump carrying
  // a module preselects course/module and shows Back-to-modules.
  const [uploadEntryModule, setUploadEntryModule] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Fail-safe: never leave the app stuck on "Loading…" if the backend
    // is down or the request hangs (e.g. backend not running on :8888).
    const timeout = setTimeout(() => {
      if (!cancelled) setAuthStatus('anonymous');
    }, 8000);

    // Session restore with one refresh fallback: the access cookie lives
    // only 15m, so a reload after idle time 401s on current-user even with
    // a valid 7-day refresh cookie present. Auth endpoints are excluded
    // from the client's silent refresh, so this first paint is the one
    // place that must attempt it explicitly — otherwise every reload past
    // 15 minutes dumps the user at sign-in.
    async function restoreSession() {
      try {
        const res = await getCurrentUser();
        if (cancelled) return;
        clearTimeout(timeout);
        if (res && res.data) {
          setStoredUid(res.data?._id || null);
          maybeKeyPrompt(res.data);
          setUser(res.data);
          setCurrentPage(defaultPageForRole(res.data.role));
          setAuthStatus('authenticated');
        } else {
          setAuthStatus('anonymous');
        }
      } catch {
        try {
          await refreshAccessToken();
          const res = await getCurrentUser();
          if (cancelled) return;
          clearTimeout(timeout);
          if (res && res.data) {
            setStoredUid(res.data?._id || null);
            maybeKeyPrompt(res.data);
            setUser(res.data);
            setCurrentPage(defaultPageForRole(res.data.role));
            setAuthStatus('authenticated');
          } else {
            setAuthStatus('anonymous');
          }
        } catch {
          if (cancelled) return;
          clearTimeout(timeout);
          setAuthStatus('anonymous');
        }
      }
    }
    restoreSession();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // Email-link entry: ?resetToken=... / ?verifyToken=... → jump straight to
  // the right logged-out screen, then scrub the token from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('resetToken');
    const vt = params.get('verifyToken');
    if (rt || vt) {
      if (rt) {
        setResetToken(rt);
        setAuthView('reset');
      } else {
        setVerifyToken(vt);
        setAuthView('verify');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Post-signup showcase role — set only by a fresh signup, so plain
  // sign-ins never see the tour.
  const [pendingRole, setPendingRole] = useState(null);
  // Optional signup-time Gemini key — verification stands between signup
  // and first login, so it waits in localStorage (plaintext, same risk
  // class as a typed-but-unsent form) and flushes to the vault once.
  const PENDING_KEY = 'cc_pending_gemini_key';

  function handleLogin(loggedInUser) {
    setStoredUid(loggedInUser?._id || null);
    // Flush any signup-time key into the vault exactly once.
    try {
      const pending = localStorage.getItem(PENDING_KEY);
      if (pending) {
        localStorage.removeItem(PENDING_KEY);
        savePendingGeminiKey(pending).catch(() => {
          // Invalid key surfaces in Account — login must not fail for it.
        });
      }
    } catch {
      // Private mode — the key simply doesn't survive; Account covers it.
    }
    maybeKeyPrompt(loggedInUser);
    setUser(loggedInUser);
    setAuthNotice(null);
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
    // Privacy first: wipe this user's cached catalog data so nothing
    // personal survives on shared machines. Read the uid before clearing
    // state — after setUser(null) it's gone.
    clearUserCache(getStoredUid());
    setStoredUid(null);
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
    // Entering Ask with a thread continues it; entering any other way
    // (or Ask without one) clears stale thread context.
    if (page === 'student-ask' && params.threadId) {
      setFollowUp({
        threadId: params.threadId,
        question: params.threadQuestion || '',
        answer: params.threadAnswer || '',
        courseId: params.courseId || '',
        moduleId: params.moduleId || '',
      });
    } else {
      setFollowUp(null);
    }
    if (page === 'student-ask') {
      setAskEntryModule(params.moduleId || null);
      // Independent visits (sidebar, no module) must not inherit stale
      // dropdowns either — otherwise the form looks pre-filled for a
      // module the student never chose.
      if (!params.moduleId) {
        setSelectedCourseId('');
        setSelectedModuleId('');
      }
    }
    if (page === 'admin-upload') {
      setUploadEntryModule(params.moduleId || null);
    }
    if (page === 'student-history' && (params.courseId || params.moduleId)) {
      setHistoryContext({
        courseId: params.courseId || '',
        moduleId: params.moduleId || '',
      });
    } else if (page === 'student-history') {
      setHistoryContext(null);
    }
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
        return (
        <StudentAsk
          initialModuleId={selectedModuleId}
          initialThread={followUp}
          entryModuleId={askEntryModule}
          onPageChange={changePage}
        />
      );

      case 'student-history':
        return (
        <StudentHistory
          onPageChange={changePage}
          initialCourseId={historyContext?.courseId}
          initialModuleId={historyContext?.moduleId}
        />
      );

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

      // Keyed by section: same component type at the same tree position
      // would otherwise reuse state across tabs (stale list under fresh
      // labels). The key forces a clean mount per section.
      case 'admin-students':
        return <AdminRoster key="students" kind="students" />;

      case 'admin-tas':
        return <AdminRoster key="tas" kind="tas" />;

      case 'admin-upload':
        return (
        <AdminUpload
          initialModuleId={uploadEntryModule}
          onPageChange={changePage}
        />
        );

      case 'account':
        return <Account />;

      default:
        return (
          <div className="rounded-lg bg-surface p-6">Page not found</div>
        );
    }
  }

  // DEV-ONLY showcase preview (?showcase=student|ta|instructor|admin,
  // dev builds only) — renders the post-signup tour with no account.
  // Remove with Showcase.jsx once it has served its purpose.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const previewRole = new URLSearchParams(window.location.search).get('showcase');
    if (previewRole && ['student', 'ta', 'instructor', 'admin'].includes(previewRole)) {
      return <Showcase role={previewRole} onContinue={() => setAuthView('login')} />;
    }
  }

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <LoadingState message="Getting things ready" />
      </div>
    );
  }

  // Email-link screens take priority over EVERYTHING — including an active
  // session. Otherwise clicking a reset/verify link while logged in just
  // lands on the dashboard and the token flow never appears.
  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onResetSuccess={() => {
          setResetToken(null);
          if (!user) {
            setAuthNotice('Password reset! Sign in with your new password.');
            setAuthView('login');
          }
        }}
      />
    );
  }

  if (verifyToken) {
    return (
      <VerifyEmail
        token={verifyToken}
        onBackToLogin={() => {
          setVerifyToken(null);
          if (!user) setAuthView('login');
        }}
      />
    );
  }

  if (authStatus === 'anonymous' || !user) {
    if (authView === 'signup') {
      return (
        <Signup
          onSignupSuccess={(role, geminiKey) => {
            // Login is hard-blocked until the email is verified, so first
            // show the role tour — then the inbox notice on the login
            // screen. Plain sign-ins never pass through here.
            setAuthNotice(
              'Account created! Check your email for the verification link, then sign in.',
            );
            try {
              if (geminiKey) localStorage.setItem(PENDING_KEY, geminiKey);
              else localStorage.removeItem(PENDING_KEY);
            } catch {
              // Private mode — Account covers key setup instead.
            }
            setPendingRole(role || 'student');
            setAuthView('showcase');
          }}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }

    // Post-signup section tour (signup only — never on plain sign-in).
    if (authView === 'showcase' && pendingRole) {
      return (
        <Showcase role={pendingRole} onContinue={() => setAuthView('login')} />
      );
    }

    if (authView === 'forgot') {
      return <ForgotPassword onBackToLogin={() => setAuthView('login')} />;
    }

    // NOTE: 'reset' and 'verify' are handled above (before the auth check)
    // so email links work whether or not a session is active.

    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignup={() => setAuthView('signup')}
        onSwitchToForgot={() => setAuthView('forgot')}
        notice={authNotice}
      />
    );
  }

      return (
        <>
          <RoleLayout
            role={user.role}
            user={user}
            currentPage={currentPage}
            onPageChange={changePage}
            onLogout={handleLogout}
          >
            {getPage()}
          </RoleLayout>
          {keyPrompt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setKeyPrompt(false)}
              />
              <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-xl">
                <h2 className="font-sans text-lg font-semibold text-heading">
                  {user.role === 'student'
                    ? 'Unlock premium answers'
                    : 'Unlock fast uploads'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-body">
                  {user.role === 'student'
                    ? 'Add your free Gemini key to get 20 top quality answers per day.'
                    : 'Add your free Gemini key to quickly upload files.'}
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setKeyPrompt(false)}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-body hover:bg-white/10 hover:text-heading hover:opacity-80"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKeyPrompt(false);
                      changePage('account');
                    }}
                    className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                  >
                    Add key
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
}
