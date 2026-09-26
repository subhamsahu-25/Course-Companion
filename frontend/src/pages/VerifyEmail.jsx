// frontend/src/pages/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { verifyEmailToken } from '../api/client.js';
// Opened via the link in the verification email (?verifyToken=...).
// Calls the API once on mount and shows the outcome.
export default function VerifyEmail({ token, onBackToLogin }) {
  const [status, setStatus] = useState('verifying'); // verifying | ok | failed
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus('failed');
      setMessage('This verification link is invalid.');
      return;
    }
    verifyEmailToken(token)
      .then(() => {
        if (!cancelled) setStatus('ok');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('failed');
          setMessage(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000f22] px-4">
      <div className="w-full max-w-142.5 text-center">
        {status === 'verifying' && (
          <div className="rounded-xl border border-[#3f6593] bg-[#1b3554] p-8 text-[#80aad3]">
            Verifying your email…
          </div>
        )}
        {status === 'ok' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8">
            <div className="text-lg font-medium text-green-800">
              Email verified!
            </div>
            <p className="mt-2 text-sm text-green-700">
              You can now sign in to your account.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-4 rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6]"
            >
              Go to sign in
            </button>
          </div>
        )}
        {status === 'failed' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8">
            <div className="text-lg font-medium text-red-800">
              Verification failed
            </div>
            <p className="mt-2 text-sm text-red-700">
              {message || 'This link is invalid or has expired.'} Request a new
              link from the sign-in page.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-4 rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6]"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
