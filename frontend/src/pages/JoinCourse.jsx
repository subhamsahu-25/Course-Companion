// frontend/src/pages/JoinCourse.jsx
//
// Shared by both the student and TA "Join a course" pages — which list
// (students vs tas) the account lands in is decided server-side, from the
// caller's own account role, so this component doesn't need to know or
// care which role is using it.
import { useState } from 'react';
import { joinCourse } from '../api/client.js';

export default function JoinCourse({ onPageChange, redirectTo }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [joinedCourse, setJoinedCourse] = useState(null);

  function handleCodeChange(event) {
    // digits only, capped at 5 — matches the 5-digit codes the backend generates
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 5);
    setCode(digitsOnly);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (code.length !== 5) return;

    setSubmitting(true);
    setError(null);
    setJoinedCourse(null);

    try {
      const res = await joinCourse(code);
      setJoinedCourse(res.data);
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Enrollment
        </div>

        <h1 className="mt-1 font-serif text-[34px] text-[#1D3557]">
          Join a course
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Enter the 5-digit code your instructor shared with you.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-sm rounded-xl border border-[#D9E1E7] bg-white p-6 shadow-sm"
      >
        <label htmlFor="code" className="text-sm font-medium text-[#2B2D42]">
          Course code
        </label>

        <input
          id="code"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={handleCodeChange}
          placeholder="12345"
          className="mt-2 w-full rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-3 text-center text-[22px] tracking-[0.3em] text-[#2B2D42] outline-none placeholder:tracking-normal placeholder:text-[#B7C4CC] focus:border-[#457B9D]"
        />

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || code.length !== 5}
          className="mt-4 w-full rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F] disabled:opacity-60"
        >
          {submitting ? 'Joining…' : 'Join course'}
        </button>
      </form>

      {joinedCourse && (
        <div className="mt-6 max-w-sm rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          You're in — joined <strong>{joinedCourse.title}</strong>.{' '}
          {onPageChange && redirectTo && (
            <button
              onClick={() => onPageChange(redirectTo)}
              className="font-medium underline"
            >
              Go there now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
