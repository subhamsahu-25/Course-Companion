// frontend/src/pages/Login.jsx
import { useState } from 'react';
import {
  login as loginRequest,
  resendEmailVerification as resendRequest,
} from '../api/client.js';

export default function Login({ onLogin, onSwitchToSignup, onSwitchToForgot, notice }) {
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
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 sm:px-6">
      <div className="w-full max-w-142.5">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#457B9D] sm:text-sm">
            Academic Portal
          </div>

          <h1 className="font-serif text-[38px] leading-[1.05] text-[#1D3557] sm:text-[48px] md:text-[56px]">
            Course Companion
            <br />
            Portal
          </h1>

          <p className="mx-auto mt-4 max-w-125 text-[15px] leading-6 text-[#457B9D] sm:mx-0 sm:text-[17px]">
            A simple place to browse course material, ask questions, and review
            answers.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[#D5DEE5] bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="identifier"
              className="text-sm font-medium text-[#2B2D42]"
            >
              Email or Username
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
              placeholder="you@example.com or username"
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#2B2D42]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
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
            className="w-full rounded-lg bg-[#1D3557] px-4 py-3 text-sm font-medium text-white hover:bg-[#28476F] disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={onSwitchToForgot}
              className="font-medium text-[#1D3557] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <p className="text-center text-sm text-[#457B9D]">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="font-medium text-[#1D3557] hover:underline"
            >
              Sign up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
