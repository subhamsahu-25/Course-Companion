// frontend/src/pages/student/Dashboard.jsx
import { useState, useEffect } from 'react';
import { getStats } from '../../api/client.js';

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
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#854F6C]">
          Student
        </div>

        <h1 className="mt-1 text-[34px] font-bold text-[#190019]">
          Your Dashboard
        </h1>

        <p className="mt-1 text-[17px] text-[#854F6C]">
          Your questions across the courses you're currently enrolled in.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-[#854F6C]">Loading...</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#2B124C] p-6 text-white shadow-sm">
            <div className="text-[40px] font-bold">{stats?.total ?? 0}</div>
            <div className="mt-1 text-[15px] text-white/85">
              Questions asked
            </div>
          </div>

          <div className="rounded-2xl bg-[#854F6C] p-6 text-white shadow-sm">
            <div className="text-[40px] font-bold">{stats?.approved ?? 0}</div>
            <div className="mt-1 text-[15px] text-white/85">Answered</div>
          </div>

          <div className="rounded-2xl bg-[#6C9BB5] p-6 text-white shadow-sm">
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
          className="min-h-30 rounded-2xl border-2 border-dashed border-[#B7C8D3] bg-white p-6 text-center text-[17px] text-[#854F6C] transition hover:border-[#854F6C] hover:bg-[#F5F9FB]"
        >
          <div className="text-2xl">→</div>
          <div className="mt-2">Browse your courses</div>
        </button>

        <button
          onClick={() => onPageChange('student-ask')}
          className="min-h-30 rounded-2xl border-2 border-dashed border-[#B7C8D3] bg-white p-6 text-center text-[17px] text-[#854F6C] transition hover:border-[#854F6C] hover:bg-[#F5F9FB]"
        >
          <div className="text-2xl">+</div>
          <div className="mt-2">Ask a question</div>
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-[#DFB6B2] bg-white p-5">
        <div className="text-[16px] font-semibold text-[#2B124C]">
          Quick note
        </div>

        <p className="mt-1 text-[15px] leading-6 text-[#854F6C]">
          Questions are reviewed by a teaching assistant before answers are
          published.
        </p>
      </div>
    </div>
  );
}
