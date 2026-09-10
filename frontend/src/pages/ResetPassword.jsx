// frontend/src/pages/ResetPassword.jsx
import { useState } from 'react';
import { resetPassword as resetPasswordRequest } from '../api/client.js';

export default function ResetPassword({ token, onResetSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6 || newPassword.length > 20) {
      setError('Password must be between 6 and 20 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordRequest(token, newPassword);
      onResetSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          This reset link is invalid. Please request a new one from the sign-in
          page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 sm:px-6">
      <div className="w-full max-w-142.5">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#457B9D] sm:text-sm">
            Academic Portal
          </div>
          <h1 className="font-serif text-[38px] leading-[1.05] text-[#1D3557] sm:text-[48px]">
            Choose a new
            <br />
            password
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[#D5DEE5] bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="new-password"
              className="text-sm font-medium text-[#2B2D42]"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
              placeholder="6–20 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-new-password"
              className="text-sm font-medium text-[#2B2D42]"
            >
              Confirm new password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
              placeholder="Repeat it"
              autoComplete="new-password"
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
            {submitting ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
