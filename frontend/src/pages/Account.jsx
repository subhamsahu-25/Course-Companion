// frontend/src/pages/Account.jsx — profile + password settings, reachable
// from every role's sidebar via the shared 'account' page key. Three parts:
//   1. Profile card → avatar (Cloudinary), username, full name, roll no.
//   2. Know your password → change it directly.
//   3. Forgot it → get a reset link by email.
import { useEffect, useRef, useState } from 'react';
import {
  changePassword as changePasswordRequest,
  forgotPassword as forgotPasswordRequest,
  getCurrentUser,
  uploadAvatar as uploadAvatarRequest,
} from '../api/client.js';
export default function Account() {
  // ---- profile state ----
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const fileRef = useRef(null);
  // ---- password state (unchanged) ----
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ---- reset-link state (unchanged) ----
  const [accountEmail, setAccountEmail] = useState('');
  const [resetState, setResetState] = useState('idle'); // idle | sending | sent
  const [resetError, setResetError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    getCurrentUser()
      .then((res) => {
        if (cancelled) return;
        const user = res.data || res.user || null;
        setProfile(user);
        setAccountEmail(user?.email || '');
        setProfileLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProfileError('Could not load your profile.');
        setResetError('Could not load your account email.');
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Only JPG, PNG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5MB.');
      return;
    }
    setAvatarUploading(true);
    try {
      const res = await uploadAvatarRequest(file);
      const updated = res.data || res.user;
      if (updated) setProfile(updated);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
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
  async function handleForgotPassword() {
    setResetError(null);
    if (!accountEmail) {
      setResetError('Could not determine your account email.');
      return;
    }
    setResetState('sending');
    try {
      await forgotPasswordRequest(accountEmail);
      setResetState('sent');
    } catch (err) {
      setResetError(err.message);
      setResetState('idle');
    }
  }
  const showRollNo =
    profile && (profile.role === 'student' || profile.role === 'ta');
  const avatarUrl = profile?.avatar || null;
  const avatarInitial = (profile?.fullName || profile?.username || '?')
    .charAt(0)
    .toUpperCase();
  return (
    <div className="mx-auto w-full max-w-125">
      <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
        Settings
      </div>
      <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">Account</h1>
      <p className="mt-2 text-[17px] text-[#80aad3]">
        Your profile and sign-in settings.
      </p>
      {/* ---- Profile card ---- */}
      <div className="mt-6 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6">
        <h2 className="text-lg font-semibold text-[#c0e6fd]">Profile</h2>
        {profileLoading ? (
          <p className="mt-3 text-sm text-[#80aad3]">Loading profile…</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#80aad3] text-xl font-semibold text-[#c0e6fd]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="size-full object-cover"
                  />
                ) : (
                  avatarInitial
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading}
                  className="rounded-lg border border-[#3f6593] bg-[#3f6593] px-4 py-2 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                >
                  {avatarUploading ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            </div>
            {avatarError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {avatarError}
              </div>
            )}
            <dl className="mt-4 space-y-2 text-[15px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[#80aad3]">Full name</dt>
                <dd className="font-medium text-[#c0e6fd]">
                  {profile?.fullName || '—'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[#80aad3]">Username</dt>
                <dd className="text-[#c0e6fd]">{profile?.username || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[#80aad3]">Email</dt>
                <dd className="min-w-0 flex-1 break-all text-[#c0e6fd]">
                  {profile?.email || '—'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[#80aad3]">Role</dt>
                <dd className="text-[#c0e6fd]">{profile?.role || '—'}</dd>
              </div>
              {showRollNo && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-[#80aad3]">Roll no.</dt>
                  <dd className="text-[#c0e6fd]">{profile?.rollNo || '—'}</dd>
                </div>
              )}
            </dl>
            {profileError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {profileError}
              </div>
            )}
          </>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6"
      >
        <h2 className="text-lg font-semibold text-[#c0e6fd]">
          Change password
        </h2>
        <div>
          <label
            htmlFor="current-password"
            className="text-sm font-medium text-[#c0e6fd]"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label
            htmlFor="account-new-password"
            className="text-sm font-medium text-[#c0e6fd]"
          >
            New password
          </label>
          <input
            id="account-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
            placeholder="6–20 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label
            htmlFor="account-confirm-password"
            className="text-sm font-medium text-[#c0e6fd]"
          >
            Confirm new password
          </label>
          <input
            id="account-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
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
          className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Change password'}
        </button>
      </form>
      <div className="mt-8 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6">
        <h2 className="text-lg font-semibold text-[#c0e6fd]">
          Forgot your current password?
        </h2>
        <p className="mt-1 break-words text-sm text-[#80aad3]">
          We&apos;ll send a reset link to{' '}
          <strong>{accountEmail || 'your account email'}</strong>. It expires in
          20 minutes.
        </p>
        {resetError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {resetError}
          </div>
        )}
        {resetState === 'sent' ? (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Reset link sent — check your inbox (and spam).
          </div>
        ) : (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetState === 'sending' || !accountEmail}
            className="mt-4 rounded-lg border border-[#3f6593] bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
          >
            {resetState === 'sending' ? 'Sending...' : 'Email me a reset link'}
          </button>
        )}
      </div>
    </div>
  );
}

