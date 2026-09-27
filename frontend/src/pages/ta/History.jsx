import { useEffect, useState } from 'react';
import {
  getCourses,
  getMyModules,
  getModuleHistory,
  getCurrentUser,
  toggleImportant,
} from '../../api/client.js';
import { RATING_LABELS, formatRating } from '../../utils/rating.js';
import { ImportantButton, LoadingState } from '../../components/ui/primitives.jsx';
import { Select } from '../../components/ui/select.jsx';
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
  // "My reviews" narrows the shared module log to items this TA resolved
  // (approved or rejected) — off by default, the full log stays primary.
  const [showMineOnly, setShowMineOnly] = useState(false);
  // Own id for the important toggles (history items are resolved, but
  // marking stays open — that's the point of marking from here).
  const [myId, setMyId] = useState(null);
  useEffect(() => {
    getCurrentUser()
      .then((res) => setMyId(res.data?._id ?? null))
      .catch(() => setMyId(null));
  }, []);
  async function toggleMark(id) {
    setHistoryError(null);
    try {
      const res = await toggleImportant(id);
      if (!myId) {
        const fresh = await getModuleHistory(historyModuleId);
        setHistoryItems(fresh.data);
        return;
      }
      const { important } = res.data;
      setHistoryItems((old) =>
        old.map((item) => {
          if (item._id !== id) return item;
          const marks = new Set(item.importantBy || []);
          if (important) marks.add(myId);
          else marks.delete(myId);
          return { ...item, importantBy: [...marks] };
        }),
      );
    } catch (err) {
      setHistoryError(err.message);
    }
  }
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
    return <LoadingState message="Getting the history ready for you" />;
  }
  const modulesForHistoryCourse = modules.filter(
    (m) => m.courseId === historyCourseId,
  );
  return (
    <div>
      <button
        onClick={() => onPageChange('ta-review')}
        className="text-sm text-body hover:text-heading hover:opacity-80"
      >
        ← Back to review queue
      </button>
      <div className="mt-4">
        <h1 className="mt-1 font-sans text-[36px] text-heading">History</h1>
        <p className="mt-2 text-[17px] text-body">
          Pick a course, then a module, to see everything ever asked in it.
        </p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-64">
          <Select
            value={historyCourseId}
            onChange={(id) => handleHistoryCourseChange(id)}
            ariaLabel="Course"
            placeholder="Select a course…"
            options={courses.map((course) => ({
              id: course._id,
              label: course.title,
            }))}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            value={historyModuleId}
            onChange={(id) => handleHistoryModuleChange(id)}
            disabled={!historyCourseId}
            ariaLabel="Module"
            placeholder={
              !historyCourseId ? 'Select a course first' : 'Select a module…'
            }
            options={modulesForHistoryCourse.map((mod) => ({
              id: mod._id,
              label: mod.title,
            }))}
          />
        </div>
      </div>
      {historyError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {historyError}
        </div>
      )}
      {loadingHistory && (
            <LoadingState message="Pulling the history together" compact />
      )}
      {!loadingHistory &&
        historyModuleId &&
        historyItems.length === 0 &&
        !historyError && (
          <p className="mt-4 text-sm text-body">
            Nothing has been asked in this module yet.
          </p>
        )}
      {!historyModuleId && (
        <p className="mt-4 text-sm text-body">
          Select a course and module above to see its history.
        </p>
      )}
      {historyModuleId && historyItems.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowMineOnly(false)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
              !showMineOnly
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-border bg-surface text-body hover:text-heading'
            }`}
          >
            All ({historyItems.length})
          </button>
          <button
            type="button"
            onClick={() => setShowMineOnly(true)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
              showMineOnly
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-border bg-surface text-body hover:text-heading'
            }`}
          >
            My reviews (
            {historyItems.filter((item) => item.reviewedBy === myId).length})
          </button>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {historyItems
          .filter((item) => !showMineOnly || item.reviewedBy === myId)
          .map((item) => (
          <div
            key={item._id}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[16px] font-semibold text-heading">
                {item.question}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.wasEdited && item.status === 'approved' && (
                  <span
                    title="The draft was edited before approval"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-heading"
                  >
                    Improved by TA
                  </span>
                )}
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
            <p className="mt-2 text-xs text-body">
              {new Date(item.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 text-[15px] leading-6 text-body">
              {item.status === 'pending'
                ? item.draftAnswer || 'Still being reviewed.'
                : item.finalAnswer}
            </p>
            <div className="mt-3">
              <ImportantButton
                marked={(item.importantBy || []).includes(myId)}
                count={item.importantBy?.length ?? 0}
                onToggle={() => toggleMark(item._id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

