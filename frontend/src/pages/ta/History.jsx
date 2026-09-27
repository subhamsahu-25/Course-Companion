import { useEffect, useState } from 'react';
import {
  getCourses,
  getMyModules,
  getModuleHistory,
} from '../../api/client.js';
import { RATING_LABELS, formatRating } from '../../utils/rating.js';
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
      const [coursesRes, modulesRes] = await Promise.all([
        getCourses(),
        getMyModules(),
      ]);
      setCourses(coursesRes.data);
      setModules(
        (modulesRes.data || []).map((mod) => ({
          ...mod,
          courseId: mod.course?._id || mod.course,
          courseTitle: mod.course?.title || '',
        })),
      );
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
    return <p className="text-sm text-[#80aad3]">Loading history...</p>;
  }
  const modulesForHistoryCourse = modules.filter(
    (m) => m.courseId === historyCourseId,
  );
  return (
    <div>
      <button
        onClick={() => onPageChange('ta-review')}
        className="text-sm text-[#80aad3] hover:text-[#c0e6fd] hover:opacity-80"
      >
        ← Back to review queue
      </button>
      <div className="mt-4">
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
          Teaching Assistant
        </div>
        <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">History</h1>
        <p className="mt-2 text-[17px] text-[#80aad3]">
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
          className="w-full rounded-md border border-[#5b86b6]/60 bg-[#3f6593] p-2.5 text-sm text-[#c0e6fd] outline-none focus:border-[#5b86b6] sm:w-64"
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
          className="w-full rounded-md border border-[#5b86b6]/60 bg-[#3f6593] p-2.5 text-sm text-[#c0e6fd] outline-none focus:border-[#5b86b6] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-[#80aad3]/60 sm:w-64"
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
        <p className="mt-4 text-sm text-[#80aad3]">Loading history...</p>
      )}
      {!loadingHistory &&
        historyModuleId &&
        historyItems.length === 0 &&
        !historyError && (
          <p className="mt-4 text-sm text-[#80aad3]">
            Nothing has been asked in this module yet.
          </p>
        )}
      {!historyModuleId && (
        <p className="mt-4 text-sm text-[#80aad3]">
          Select a course and module above to see its history.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {historyItems.map((item) => (
          <div
            key={item._id}
            className="rounded-xl border border-[#3f6593] bg-[#1b3554] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[16px] font-semibold text-[#c0e6fd]">
                {item.question}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {formatRating(item.rating) && (
                  <span
                    title={RATING_LABELS[item.rating]}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                  >
                    {formatRating(item.rating)}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    HISTORY_STATUS_STYLES[item.status] ||
                    'bg-gray-100 text-gray-600'
                  }`}
                >
                  {HISTORY_STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#80aad3]">
              {new Date(item.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 text-[15px] leading-6 text-[#80aad3]">
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

