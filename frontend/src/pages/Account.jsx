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
  getGeminiKeyStatus,
  setGeminiKey as saveGeminiKey,
  deleteGeminiKey as removeGeminiKey,
} from '../api/client.js';
import { LoadingDots, LoadingState } from '../components/ui/primitives.jsx';
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
  // ---- Gemini key (BYOK) state ----
  const [keyStatus, setKeyStatus] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getGeminiKeyStatus()
      .then((res) => {
        if (!cancelled) setKeyStatus(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setKeyStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function handleSaveKey(event) {
    event.preventDefault();
    if (keyInput.trim().length < 10 || keyBusy) return;
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      const res = await saveGeminiKey(keyInput.trim());
      setKeyStatus(res.data || null);
      setKeyInput('');
      setKeyMsg({ tone: 'ok', text: res.message || 'Key saved.' });
    } catch (err) {
      setKeyMsg({ tone: 'error', text: err.message });
    } finally {
      setKeyBusy(false);
    }
  }
  async function handleRemoveKey() {
    if (keyBusy) return;
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      await removeGeminiKey();
      setKeyStatus({ present: false });
    } catch (err) {
      setKeyMsg({ tone: 'error', text: err.message });
    } finally {
      setKeyBusy(false);
    }
  }
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
      <h1 className="mt-1 font-sans text-[36px] text-heading">Account</h1>
      <p className="mt-2 text-[17px] text-body">
        Your profile and sign-in settings.
      </p>
      {/* ---- Profile card ---- */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-heading">Profile</h2>
        {profileLoading ? (
          <LoadingState message="Getting your profile ready" compact />
        ) : (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-body text-xl font-semibold text-heading">
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
                  className="rounded-lg border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                >
                  {avatarUploading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingDots /> Uploading
                    </span>
                  ) : (
                    'Change photo'
                  )}
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
                <dt className="w-24 shrink-0 text-body">Full name</dt>
                <dd className="font-medium text-heading">
                  {profile?.fullName || '—'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-body">Username</dt>
                <dd className="text-heading">{profile?.username || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-body">Email</dt>
                <dd className="min-w-0 flex-1 break-all text-heading">
                  {profile?.email || '—'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-body">Role</dt>
                <dd className="text-heading">{profile?.role || '—'}</dd>
              </div>
              {showRollNo && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-body">Roll no.</dt>
                  <dd className="text-heading">{profile?.rollNo || '—'}</dd>
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
        className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold text-heading">
          Change password
        </h2>
        <div>
          <label
            htmlFor="current-password"
            className="text-sm font-medium text-heading"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border p-3 text-[15px] outline-none focus:border-accent"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label
            htmlFor="account-new-password"
            className="text-sm font-medium text-heading"
          >
            New password
          </label>
          <input
            id="account-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border p-3 text-[15px] outline-none focus:border-accent"
            placeholder="6–20 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label
            htmlFor="account-confirm-password"
            className="text-sm font-medium text-heading"
          >
            Confirm new password
          </label>
          <input
            id="account-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border p-3 text-[15px] outline-none focus:border-accent"
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
          className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LoadingDots /> Saving
            </span>
          ) : (
            'Change password'
          )}
        </button>
      </form>
      {/* Same gate as signup: TA keys would fund nothing (no Ask UI,
          no uploads), so the section hides for that role entirely. */}
      {profile?.role !== 'ta' && (
      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-heading">
          Gemini API key
        </h2>
        <p className="mt-1 text-sm text-body">
          {profile?.role === 'instructor' || profile?.role === 'admin'
            ? 'Optional. Your key funds overview and figure-caption generation when you upload documents — shared quota stays the fallback. Stored encrypted, deletable anytime.'
            : 'Optional. Your key funds your own premium answers (about 20 top-quality answers a day) — shared quota stays the fallback. Stored encrypted, used only for your questions, deletable anytime.'}
        </p>
        {keyStatus?.present ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-heading">
                {keyStatus.masked || '••••'}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  keyStatus.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : keyStatus.status === 'exhausted'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                }`}
              >
                {keyStatus.status === 'active'
                  ? 'Active'
                  : keyStatus.status === 'exhausted'
                    ? 'Quota done — back tomorrow'
                    : keyStatus.status || 'Unknown'}
              </span>
              {typeof keyStatus.usageToday === 'number' && (
                <span className="text-xs text-body">
                  {keyStatus.usageToday} used today
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemoveKey}
              disabled={keyBusy}
              className="text-xs font-medium text-red-400/70 hover:text-red-400 hover:underline hover:opacity-80 disabled:opacity-60"
            >
              Remove key
            </button>
          </div>
        ) : null}
        <form onSubmit={handleSaveKey} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={
              keyStatus?.present ? 'Paste a new key to replace' : 'Paste your Gemini API key'
            }
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg p-3 font-mono text-sm text-heading outline-none placeholder:font-sans placeholder:text-body focus:border-accent"
          />
          <button
            type="submit"
            disabled={keyBusy || keyInput.trim().length < 10}
            className="shrink-0 rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {keyBusy ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots /> Saving
              </span>
            ) : keyStatus?.present ? (
              'Replace key'
            ) : (
              'Save key'
            )}
          </button>
        </form>
        {keyMsg && (
          <div
            className={`mt-3 rounded-lg border p-3 text-sm ${
              keyMsg.tone === 'ok'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {keyMsg.text}
          </div>
        )}
        <p className="mt-3 text-xs text-body">
          Get one free at AI Studio (aistudio.google.com) → Get API key.
          Never share it — anyone with it spends your quota.
        </p>
      </div>
      )}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-heading">
          Forgot your current password?
        </h2>
        <p className="mt-1 break-words text-sm text-body">
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
            className="mt-4 rounded-lg border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {resetState === 'sending' ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots /> Sending
              </span>
            ) : (
              'Email me a reset link'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

