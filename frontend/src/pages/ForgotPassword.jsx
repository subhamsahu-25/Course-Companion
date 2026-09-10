// frontend/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { forgotPassword as forgotPasswordRequest } from '../api/client.js';

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
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 sm:px-6">
      <div className="w-full max-w-142.5">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#457B9D] sm:text-sm">
            Academic Portal
          </div>
          <h1 className="font-serif text-[38px] leading-[1.05] text-[#1D3557] sm:text-[48px]">
            Reset your
            <br />
            password
          </h1>
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-sm text-green-800">
            If an account exists for <strong>{email.trim()}</strong>, a reset
            link is on its way. It expires in 20 minutes — check your inbox
            (and spam).
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-[#D5DEE5] bg-white p-6 shadow-sm sm:p-8"
          >
            <p className="text-sm text-[#457B9D]">
              Enter the email you signed up with and we'll send you a reset link.
            </p>
            <div>
              <label
                htmlFor="forgot-email"
                className="text-sm font-medium text-[#2B2D42]"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
                placeholder="you@example.com"
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
              className="w-full rounded-lg bg-[#1D3557] px-4 py-3 text-sm font-medium text-white hover:bg-[#28476F] disabled:opacity-60"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-[#457B9D]">
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-medium text-[#1D3557] hover:underline"
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
