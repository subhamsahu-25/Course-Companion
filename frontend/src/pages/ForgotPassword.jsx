// frontend/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { forgotPassword as forgotPasswordRequest } from '../api/client.js';
import { LoadingDots } from '../components/ui/primitives.jsx';
export default function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setSubmitting(true);
    try {
      await forgotPasswordRequest(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8 sm:px-6">
      <div className="w-full max-w-142.5">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-body sm:text-sm">
            Academic Portal
          </div>
          <h1 className="font-sans text-[38px] leading-[1.05] text-heading sm:text-[48px]">
            Reset your
            <br />
            password
          </h1>
        </div>
        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-sm text-green-800">
            If an account exists for <strong>{email.trim()}</strong>, a reset
            link is on its way. It expires in 20 minutes — check your inbox (and
            spam).
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
          >
            <p className="text-sm text-body">
              Enter the email you signed up with and we'll send you a reset
              link.
            </p>
            <div>
              <label
                htmlFor="forgot-email"
                className="text-sm font-medium text-heading"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border p-3 text-[15px] outline-none focus:border-accent"
                placeholder="Email address"
                autoComplete="email"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingDots /> Sending
                </span>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-body">
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-medium text-heading hover:underline hover:opacity-80"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}


