import { useEffect, useState } from 'react';
import {
  getCourses,
  getModulesByCourse,
  getModuleHistory,
} from '../../api/client.js';

const HISTORY_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

const HISTORY_STATUS_LABELS = {
  pending: 'Awaiting review',
  approved: 'Answered',
  rejected: 'Rejected',
};

export default function History({ onPageChange }) {
  const [courses, setCourses] = useState([]);
  // Flattened modules across every course the TA has, each tagged with
  // its course id/title so the module dropdown can be filtered to just
  // the selected course without a second lookup per render.
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deliberately no "all courses" option here: history requires an
  // explicit course, then module, pick and shows every status, not just
  // pending — unlike the live review queue's course/module filters.
  const [historyCourseId, setHistoryCourseId] = useState('');
  const [historyModuleId, setHistoryModuleId] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    loadCoursesAndModules();
  }, []);

  async function loadCoursesAndModules() {
    setLoading(true);
    setError(null);
    try {
      const coursesRes = await getCourses();
      setCourses(coursesRes.data);

      const modulesPerCourse = await Promise.all(
        coursesRes.data.map((course) => getModulesByCourse(course._id)),
      );
      const flat = modulesPerCourse.flatMap((res, i) =>
        res.data.map((mod) => ({
          ...mod,
          courseId: coursesRes.data[i]._id,
          courseTitle: coursesRes.data[i].title,
        })),
      );
      setModules(flat);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleHistoryCourseChange(courseId) {
    setHistoryCourseId(courseId);
    setHistoryModuleId('');
    setHistoryItems([]);
  }

  async function handleHistoryModuleChange(moduleId) {
    setHistoryModuleId(moduleId);
    setHistoryItems([]);
    if (!moduleId) return;

    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await getModuleHistory(moduleId);
      setHistoryItems(res.data);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading history...</p>;
  }

  const modulesForHistoryCourse = modules.filter(
    (m) => m.courseId === historyCourseId,
  );

  return (
    <div>
      <button
        onClick={() => onPageChange('ta-review')}
        className="text-sm text-[#457B9D] hover:text-[#1D3557]"
      >
        ← Back to review queue
      </button>

      <div className="mt-4">
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Teaching Assistant
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">History</h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Pick a course, then a module, to see everything ever asked in it.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <select
          value={historyCourseId}
          onChange={(e) => handleHistoryCourseChange(e.target.value)}
          className="w-full rounded-md border border-[#C8D6DF] bg-white p-2.5 text-sm text-[#2B2D42] outline-none focus:border-[#457B9D] sm:w-64"
        >
          <option value="">Select a course…</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>
              {course.title}
            </option>
          ))}
        </select>

        <select
          value={historyModuleId}
          onChange={(e) => handleHistoryModuleChange(e.target.value)}
          disabled={!historyCourseId}
          className="w-full rounded-md border border-[#C8D6DF] bg-white p-2.5 text-sm text-[#2B2D42] outline-none focus:border-[#457B9D] disabled:cursor-not-allowed disabled:bg-[#F1F4F6] disabled:text-[#9AAAB5] sm:w-64"
        >
          {!historyCourseId && <option value="">Select a course first</option>}
          {historyCourseId && (
            <>
              <option value="">Select a module…</option>
              {modulesForHistoryCourse.map((mod) => (
                <option key={mod._id} value={mod._id}>
                  {mod.title}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {historyError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {historyError}
        </div>
      )}

      {loadingHistory && (
        <p className="mt-4 text-sm text-[#647D8D]">Loading history...</p>
      )}

      {!loadingHistory &&
        historyModuleId &&
        historyItems.length === 0 &&
        !historyError && (
          <p className="mt-4 text-sm text-[#8AA0AE]">
            Nothing has been asked in this module yet.
          </p>
        )}

      {!historyModuleId && (
        <p className="mt-4 text-sm text-[#8AA0AE]">
          Select a course and module above to see its history.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {historyItems.map((item) => (
          <div
            key={item._id}
            className="rounded-xl border border-[#D9E1E7] bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[16px] font-semibold text-[#2B2D42]">
                {item.question}
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  HISTORY_STATUS_STYLES[item.status] ||
                  'bg-gray-100 text-gray-600'
                }`}
              >
                {HISTORY_STATUS_LABELS[item.status] || item.status}
              </span>
            </div>

            <p className="mt-2 text-xs text-[#8AA0AE]">
              {new Date(item.createdAt).toLocaleString()}
            </p>

            <p className="mt-3 text-[15px] leading-6 text-[#354F61]">
              {item.status === 'pending'
                ? item.draftAnswer || 'Still being reviewed.'
                : item.finalAnswer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
