// frontend/src/pages/student/Dashboard.jsx
import { useState, useEffect } from 'react';
import { getStats } from '../../api/client.js';
import { LoadingState } from '../../components/ui/primitives.jsx';
export default function StudentDashboard({ onPageChange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadStats();
  }, []);
  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await getStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-body">
          Student
        </div>
        <h1 className="mt-1 text-[34px] font-bold text-heading">
          Your Dashboard
        </h1>
        <p className="mt-1 text-[17px] text-body">
          Your questions across the courses you're currently enrolled in.
        </p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingState message="Getting your dashboard ready" compact />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-6 text-white shadow-sm">
            <div className="text-[40px] font-bold">{stats?.total ?? 0}</div>
            <div className="mt-1 text-[15px] text-white/85">
              Questions asked
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-6 text-white shadow-sm">
            <div className="text-[40px] font-bold">{stats?.approved ?? 0}</div>
            <div className="mt-1 text-[15px] text-white/85">Answered</div>
          </div>
          <div className="rounded-2xl bg-body p-6 text-accent-ink shadow-sm">
            <div className="text-[40px] font-bold">{stats?.pending ?? 0}</div>
            <div className="mt-1 text-[15px] text-white/85">
              Awaiting TA review
            </div>
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <button
          onClick={() => onPageChange('student-courses')}
          className="min-h-30 rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center text-[17px] text-body transition-all duration-200 ease-out hover:border-accent-hover hover:bg-white/5"
        >
          <div className="text-2xl">→</div>
          <div className="mt-2">Browse your courses</div>
        </button>
        <button
          onClick={() => onPageChange('student-ask')}
          className="min-h-30 rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center text-[17px] text-body transition-all duration-200 ease-out hover:border-accent-hover hover:bg-white/5"
        >
          <div className="text-2xl">+</div>
          <div className="mt-2">Ask a question</div>
        </button>
      </div>
      <div className="mt-8 rounded-xl border border-border bg-surface p-5">
        <div className="text-[16px] font-semibold text-heading">
          Quick note
        </div>
        <p className="mt-1 text-[15px] leading-6 text-body">
          Questions are reviewed by a teaching assistant before answers are
          published.
        </p>
      </div>
    </div>
  );
}

