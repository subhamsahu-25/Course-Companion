// frontend/src/pages/Signup.jsx
import { useState } from 'react';
import { register as registerRequest } from '../api/client.js';

export default function Signup({ onSignupSuccess, onSwitchToLogin }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const needsRollNo = role === 'student' || role === 'ta';

  function handleRoleChange(event) {
    setRole(event.target.value);
    // Don't keep a stale roll number when switching to instructor.
    if (event.target.value === 'instructor') setRollNo('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (needsRollNo && !rollNo.trim()) {
      setError('Please enter your roll number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await registerRequest(
        email.trim(),
        username.trim(),
        password,
        role,
        needsRollNo ? rollNo.trim() : undefined,
        fullName.trim(),
      );
      onSignupSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#FBE4D8]">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#190019] p-10 text-[#FBE4D8] lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#522B5B] opacity-60 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-[#854F6C] opacity-40 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#DFB6B2]">
            Academic Portal
          </div>
          <h1 className="font-sans text-[48px] font-bold leading-[1.05]">
            Create your
            <br />
            account
          </h1>
          <p className="mt-4 max-w-100 text-[15px] leading-6 text-[#DFB6B2]">
            Join to browse course material, ask questions, and review answers.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-[#DFB6B2]">
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#FBE4D8]">1</span>
            Pick your role — student, TA, or instructor
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#FBE4D8]">2</span>
            Join courses with a 5-digit code
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 font-semibold text-[#FBE4D8]">3</span>
            Verify your email and start learning
          </li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-142.5">
        <div className="mb-8 text-center sm:mb-10 sm:text-left lg:hidden">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#854F6C] sm:text-sm">
            Academic Portal
          </div>

          <h1 className="font-sans text-[38px] leading-[1.05] text-[#2B124C] sm:text-[48px] md:text-[56px]">
            Create your
            <br />
            account
          </h1>

          <p className="mx-auto mt-4 max-w-125 text-[15px] leading-6 text-[#854F6C] sm:mx-0 sm:text-[17px]">
            Join to browse course material, ask questions, and review answers.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[#DFB6B2] bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="fullName"
              className="text-sm font-medium text-[#190019]"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
              placeholder="e.g. Aarav Sharma"
              autoComplete="name"
              maxLength={60}
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-[#190019]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="username"
              className="text-sm font-medium text-[#190019]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
              placeholder="username"
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="role"
              className="text-sm font-medium text-[#190019]"
            >
              I am a
            </label>
            <select
              id="role"
              value={role}
              onChange={handleRoleChange}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] bg-white p-3 text-[15px] outline-none focus:border-[#854F6C]"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="ta">Teaching Assistant</option>
            </select>
          </div>

          {needsRollNo && (
            <div>
              <label
                htmlFor="rollNo"
                className="text-sm font-medium text-[#190019]"
              >
                Roll Number
              </label>
              <input
                id="rollNo"
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
                placeholder="e.g. 2024CS001"
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#190019]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-[#190019]"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DFB6B2] p-3 text-[15px] outline-none focus:border-[#854F6C]"
              placeholder="••••••••"
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
            className="w-full rounded-lg bg-[#2B124C] px-4 py-3 text-sm font-medium text-[#FBE4D8] hover:bg-[#522B5B] disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
          <p className="text-center text-sm text-[#854F6C]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-[#2B124C] hover:underline"
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
      </div>
    </div>
  );
}
