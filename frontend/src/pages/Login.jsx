// frontend/src/pages/Login.jsx
import { useState } from 'react';
import {
  login as loginRequest,
  resendEmailVerification as resendRequest,
} from '../api/client.js';
export default function Login({
  onLogin,
  onSwitchToSignup,
  onSwitchToForgot,
  notice,
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when the backend 403s on an unverified account — offers an inline
  // resend instead of a dead-end error.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginRequest(identifier.trim(), password);
      onLogin(res.data.user);
    } catch (err) {
      setError(err.message);
      if (err.statusCode === 403) setNeedsVerification(true);
    } finally {
      setSubmitting(false);
    }
  }
  async function handleResend() {
    setResendState('sending');
    try {
      await resendRequest(identifier.trim());
      setResendState('sent');
    } catch (err) {
      setError(err.message);
      setResendState('idle');
    }
  }
  return (
    <div className="flex min-h-screen bg-[#000f22]">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#000f22] p-10 text-[#c0e6fd] lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#3f6593] opacity-60 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-[#5b86b6] opacity-40 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#80aad3]">
            Academic Portal
          </div>
          <h1 className="font-sans text-[48px] font-bold leading-[1.05]">
            Course
            <br />
            Companion
          </h1>
          <p className="mt-4 max-w-100 text-[15px] leading-6 text-[#80aad3]">
            A simple place to browse course material, ask questions, and review
            answers.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-[#80aad3]">
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#c0e6fd]">
              1
            </span>
            Browse course material by module
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#c0e6fd]">
              2
            </span>
            Ask questions, get TA-reviewed answers
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#c0e6fd]">
              3
            </span>
            Track everything in History
          </li>
        </ul>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-142.5">
          <div className="mb-8 text-center sm:mb-10 sm:text-left lg:hidden">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#80aad3] sm:text-sm">
              Academic Portal
            </div>
            <h1 className="font-sans text-[38px] leading-[1.05] text-[#c0e6fd] sm:text-[48px] md:text-[56px]">
              Course Companion
              <br />
              Portal
            </h1>
            <p className="mx-auto mt-4 max-w-125 text-[15px] leading-6 text-[#80aad3] sm:mx-0 sm:text-[17px]">
              A simple place to browse course material, ask questions, and
              review answers.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm sm:p-8"
          >
            <div>
              <label
                htmlFor="identifier"
                className="text-sm font-medium text-[#c0e6fd]"
              >
                Email or Username
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
                placeholder="you@example.com or username"
                autoComplete="username"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#c0e6fd]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {notice && !error && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {notice}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {needsVerification && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {resendState === 'sent' ? (
                  <>Verification email sent — check your inbox (and spam).</>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                    className="font-medium underline hover:no-underline disabled:opacity-60"
                  >
                    {resendState === 'sending'
                      ? 'Sending...'
                      : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-3 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="font-medium text-[#c0e6fd] hover:underline hover:opacity-80"
              >
                Forgot password?
              </button>
            </div>
            <p className="text-center text-sm text-[#80aad3]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-medium text-[#c0e6fd] hover:underline hover:opacity-80"
              >
                Sign up
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}


