import { useEffect, useState } from 'react';
import {
  getReviewQueue,
  approveAnswer,
  rejectAnswer,
  getCourses,
  getMyModules,
} from '../../api/client.js';
import { RATING_LABELS } from '../../utils/rating.js';
export default function ReviewQueue({ onPageChange }) {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  // Flattened modules across every course the TA has, each tagged with
  // its course id/title so a question can be traced back to "which
  // course, which module" without a second lookup per render.
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // '' means "All courses" — no filtering.
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  // Pending item id -> 1..5 star rating. Absent key = unattended (sent as
  // undefined, stored as null) — never defaulted, so "unrated" stays
  // distinct from "rated poorly".
  const [ratings, setRatings] = useState({});
  function setRating(id, value) {
    // Clicking the active star again clears it back to unattended.
    setRatings((old) => ({ ...old, [id]: old[id] === value ? undefined : value }));
  }
  // In-flight actions by item id, so every clicked button shows its own
  // …ing label even when several items are processing at once. Previously
  // this held a single { id, kind }, so clicking approve on a second item
  // stole the loading label while the first request was still running.
  // { [id]: 'approve' | 'reject' }
  const [actioning, setActioning] = useState({});
  const busyKindFor = (id) => actioning[id] ?? null;
  const isBusy = (id) => Boolean(actioning[id]);
  // Quiet mode (manual Refresh button) refetches without flashing the
  // full-page "Loading..." state — the current list stays visible while
  // fresh data comes in, so TAs never need a browser reload (which would
  // also re-run session restore) just to see newly arrived questions.
  const [refreshing, setRefreshing] = useState(false);
  async function loadAll(quiet = false) {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [queueRes, coursesRes, modulesRes] = await Promise.all([
        getReviewQueue(),
        getCourses(),
        getMyModules(),
      ]);
      setItems(queueRes.data);
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
      setRefreshing(false);
    }
  }
  useEffect(() => {
    loadAll();
  }, []);
  // After approve/reject, only the queue itself needs refetching — the
  // course/module list underneath it hasn't changed.
  async function reloadQueue() {
    try {
      const res = await getReviewQueue();
      setItems(res.data);
    } catch (err) {
      setError(err.message);
    }
  }
  function startEditing(item) {
    setEditingId(item._id);
    setAnswerText(item.draftAnswer);
  }
  function cancelEditing() {
    setEditingId(null);
    setAnswerText('');
  }
  function markBusy(id, kind) {
    setActioning((old) => ({ ...old, [id]: kind }));
  }
  function clearBusy(id) {
    setActioning((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }
  async function approve(id, editedAnswer, rating) {
    markBusy(id, 'approve');
    setError(null);
    try {
      await approveAnswer(id, editedAnswer, rating);
      setEditingId(null);
      setAnswerText('');
      setRatings((old) => ({ ...old, [id]: undefined }));
      await reloadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      clearBusy(id);
    }
  }
  async function reject(id) {
    const note = window.prompt(
      'Optional note for the student (leave blank to use the default message):',
    );
    if (note === null) return; // they hit cancel
    markBusy(id, 'reject');
    setError(null);
    try {
      await rejectAnswer(id, note || undefined);
      await reloadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      clearBusy(id);
    }
  }
  if (loading) {
    return <p className="text-sm text-[#80aad3]">Loading review queue...</p>;
  }
  const moduleById = new Map(modules.map((m) => [m._id, m]));
  // Pending counts per course and per module — this is what powers the
  // red badges, computed fresh from the current queue rather than a
  // separate endpoint, so it's always exactly consistent with what's
  // actually shown below.
  const countsByCourse = {};
  const countsByModule = {};
  for (const item of items) {
    if (!item.moduleId) continue;
    countsByModule[item.moduleId] = (countsByModule[item.moduleId] || 0) + 1;
    const courseId = moduleById.get(item.moduleId)?.courseId;
    if (courseId)
      countsByCourse[courseId] = (countsByCourse[courseId] || 0) + 1;
  }
  const modulesForSelectedCourse = modules.filter(
    (m) => m.courseId === selectedCourseId,
  );
  const visibleItems = items.filter((item) => {
    if (selectedCourseId) {
      const courseId = moduleById.get(item.moduleId)?.courseId;
      if (courseId !== selectedCourseId) return false;
      if (selectedModuleId && item.moduleId !== selectedModuleId) return false;
    }
    return true;
  });
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
            Teaching Assistant
          </div>
          <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">
            Review Queue
          </h1>
          <p className="mt-2 text-[17px] text-[#80aad3]">
            Check drafted answers before they are published.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing || loading}
            className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh ⟳'}
          </button>
          <button
            onClick={() => onPageChange('ta-history')}
            className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6]"
          >
            View history →
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* Courses section — pick which course's queue to look at, with a
          red badge showing how many of its questions are still pending. */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setSelectedCourseId('');
            setSelectedModuleId('');
          }}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
            selectedCourseId === ''
              ? 'border-[#1b3554] bg-[#1b3554] text-white'
              : 'border-[#3f6593] bg-[#1b3554] text-[#c0e6fd] hover:bg-[#5b86b6]'
          }`}
        >
          All courses
          {items.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
              {items.length}
            </span>
          )}
        </button>
        {courses.map((course) => (
          <button
            key={course._id}
            onClick={() => {
              setSelectedCourseId(course._id);
              setSelectedModuleId('');
            }}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
              selectedCourseId === course._id
                ? 'border-[#1b3554] bg-[#1b3554] text-white'
                : 'border-[#3f6593] bg-[#1b3554] text-[#c0e6fd] hover:bg-[#5b86b6]'
            }`}
          >
            {course.title}
            {countsByCourse[course._id] > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                {countsByCourse[course._id]}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Module breakdown for the selected course — same red-badge idea,
          one level down. */}
      {selectedCourseId && modulesForSelectedCourse.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedModuleId('')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
              selectedModuleId === ''
                ? 'border-[#5b86b6] bg-white/5 text-[#c0e6fd]'
                : 'border-[#3f6593] bg-[#1b3554] text-[#80aad3] hover:bg-white/10'
            }`}
          >
            All modules
          </button>
          {modulesForSelectedCourse.map((mod) => (
            <button
              key={mod._id}
              onClick={() => setSelectedModuleId(mod._id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
                selectedModuleId === mod._id
                  ? 'border-[#5b86b6] bg-white/5 text-[#c0e6fd]'
                  : 'border-[#3f6593] bg-[#1b3554] text-[#80aad3] hover:bg-white/10'
              }`}
            >
              {mod.title}
              {countsByModule[mod._id] > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {countsByModule[mod._id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {visibleItems.length === 0 && !error && (
        <p className="mt-8 text-sm text-[#80aad3]">
          Nothing waiting on review here.
        </p>
      )}
      <div className="mt-8 space-y-5">
        {visibleItems.map((item) => {
          const mod = moduleById.get(item.moduleId);
          return (
            <div
              key={item._id}
              className="overflow-hidden rounded-xl border border-[#3f6593] bg-[#1b3554] shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#80aad3]">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  {mod && (
                    <span className="rounded-full bg-[#1b3554] px-2.5 py-0.5 text-xs text-[#80aad3]">
                      {mod.courseTitle} — {mod.title}
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-[#1b3554] px-3 py-1 text-xs text-[#80aad3]">
                  {item.status}
                </span>
              </div>
              <div className="p-6">
                <div className="text-[18px] font-semibold text-[#c0e6fd]">
                  {item.question}
                </div>
                {editingId === item._id ? (
                  <textarea
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    rows="5"
                    className="mt-4 w-full rounded-lg border border-[#3f6593] p-3 text-[15px] outline-none focus:border-[#5b86b6]"
                  />
                ) : (
                  <p className="mt-4 text-[15px] leading-6 text-[#80aad3]">
                    {item.draftAnswer}
                  </p>
                )}
                {/* Optional star rating — travels with the approval and
                    decides whether the answer teaches future drafts (3+,
                    or unrated) or is kept out (1–2). */}
                <div className="mt-5 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs font-medium uppercase tracking-wide text-[#80aad3]">
                    Rate
                  </span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      title={RATING_LABELS[star]}
                      aria-label={`Rate ${star} out of 5: ${RATING_LABELS[star]}`}
                      onClick={() => setRating(item._id, star)}
                      disabled={isBusy(item._id)}
                      className={`text-xl leading-none transition-all duration-150 ease-out active:scale-90 disabled:opacity-60 ${
                        ratings[item._id] >= star
                          ? 'text-amber-400'
                          : 'text-[#5b86b6]/50 hover:text-amber-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-1 text-xs text-[#80aad3]/70">
                    {ratings[item._id]
                      ? RATING_LABELS[ratings[item._id]]
                      : 'optional'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {editingId === item._id ? (
                    <>
                      <button
                        onClick={() =>
                          approve(item._id, answerText, ratings[item._id])
                        }
                        disabled={isBusy(item._id)}
                        className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                      >
                        {busyKindFor(item._id) === 'approve'
                          ? 'Saving…'
                          : 'Save & approve'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={isBusy(item._id)}
                        className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          approve(item._id, undefined, ratings[item._id])
                        }
                        disabled={isBusy(item._id)}
                        className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                      >
                        {busyKindFor(item._id) === 'approve'
                          ? 'Approving…'
                          : 'Approve'}
                      </button>
                      <button
                        onClick={() => startEditing(item)}
                        disabled={isBusy(item._id)}
                        className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => reject(item._id)}
                        disabled={isBusy(item._id)}
                        className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
                      >
                        {busyKindFor(item._id) === 'reject'
                          ? 'Rejecting…'
                          : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

