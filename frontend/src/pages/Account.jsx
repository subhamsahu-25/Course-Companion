// frontend/src/pages/Account.jsx — change-password screen, reachable from
// every role's sidebar via the shared 'account' page key.
import { useState } from 'react';
import { changePassword as changePasswordRequest } from '../api/client.js';

export default function Account() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!oldPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 20) {
      setError('New password must be between 6 and 20 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePasswordRequest(oldPassword, newPassword);
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
        Settings
      </div>
      <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">Account</h1>
      <p className="mt-2 text-[17px] text-[#647D8D]">
        Change the password you sign in with.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-125 space-y-4 rounded-xl border border-[#D9E1E7] bg-white p-6"
      >
        <div>
          <label
            htmlFor="current-password"
            className="text-sm font-medium text-[#2B2D42]"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label
            htmlFor="account-new-password"
            className="text-sm font-medium text-[#2B2D42]"
          >
            New password
          </label>
          <input
            id="account-new-password"
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
            htmlFor="account-confirm-password"
            className="text-sm font-medium text-[#2B2D42]"
          >
            Confirm new password
          </label>
          <input
            id="account-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Password changed successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F] disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
