import { useEffect, useState, useRef } from 'react';
import {
  getReviewQueue,
  approveAnswer,
  rejectAnswer,
  retryAnswer,
  toggleImportant,
  getCourses,
  getMyModules,
  getCurrentUser,
} from '../../api/client.js';
import { RATING_LABELS } from '../../utils/rating.js';
import { ImportantButton, LoadingDots, LoadingState } from '../../components/ui/primitives.jsx';
// Stamp waiting-days at fetch time (not in render — Date.now() in render
// breaks purity lint and recomputes on every keystroke anyway). Module
// scope so the declaration-order rule stays happy.
function withWaitingDays(list) {
  const now = Date.now();
  return (list || []).map((item) => ({
    ...item,
    waitingDays: Math.floor(
      (now - new Date(item.createdAt).getTime()) / (24 * 3600 * 1000),
    ),
  }));
}
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
  // Quiet mode (manual Refresh button) refetches without flashing the
  // full-page "Loading..." state — the current list stays visible while
  // fresh data comes in, so TAs never need a browser reload (which would
  // also re-run session restore) just to see newly arrived questions.
  const [refreshing, setRefreshing] = useState(false);
  // Own user id — needed to know which important checkboxes are mine.
  // A missing session here just means no box renders as checked.
  const [myId, setMyId] = useState(null);
  // Synchronous mirror of items for optimistic snapshots. State updaters
  // run asynchronously, so snapshotting via a setItems side-effect ALWAYS
  // reads back null — which once silently aborted every approve/reject
  // after removing its card. Synced post-render (not during it) so the
  // refs rule stays happy; event handlers always see the latest list.
  const itemsRef = useRef([]);
  useEffect(() => {
    itemsRef.current = items;
  });
  async function loadAll(quiet = false) {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [queueRes, coursesRes, modulesRes, meRes] = await Promise.all([
        getReviewQueue(),
        getCourses(),
        getMyModules(),
        getCurrentUser().catch(() => null),
      ]);
      setItems(withWaitingDays(queueRes.data));
      setMyId(meRes?.data?._id ?? null);
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
      setItems(withWaitingDays(res.data));
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
  // Optimistic resolve: the card leaves the screen instantly while the
  // request runs behind it — no more staring at "Approving…". A failure
  // puts the card back where it was and raises the error banner, so a
  // flaky network can never silently eat a decision.
  function removeCard(id) {
    const current = itemsRef.current;
    const index = current.findIndex((item) => item._id === id);
    if (index === -1) return null;
    const snapshot = { item: current[index], index };
    setItems(current.filter((item) => item._id !== id));
    return snapshot;
  }
  function restoreCard(snapshot) {
    if (!snapshot) return;
    setItems((old) => {
      const index = Math.min(snapshot.index, old.length);
      return [...old.slice(0, index), snapshot.item, ...old.slice(index)];
    });
  }
  // 1-second acknowledgement beat: the button shows Approving… /
  // Rejecting… for a beat so the tap registers visibly, THEN the card
  // leaves and the request runs backstage. Failure restores the card.
  const [pendingRemoval, setPendingRemoval] = useState({});
  const pendingTimers = useRef({});
  useEffect(
    () => () => {
      Object.values(pendingTimers.current).forEach(clearTimeout);
    },
    [],
  );
  async function beatThenRemove(id, kind) {
    if (pendingRemoval[id]) return false;
    setPendingRemoval((old) => ({ ...old, [id]: kind }));
    await new Promise((resolve) => {
      pendingTimers.current[id] = setTimeout(resolve, 1000);
    });
    delete pendingTimers.current[id];
    const snapshot = removeCard(id);
    setPendingRemoval((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    return snapshot;
  }
  async function approve(id, editedAnswer, rating) {
    const snapshot = await beatThenRemove(id, 'approve');
    if (!snapshot) return;
    setEditingId(null);
    setAnswerText('');
    setRatings((old) => ({ ...old, [id]: undefined }));
    setError(null);
    try {
      await approveAnswer(id, editedAnswer, rating);
    } catch (err) {
      setError(err.message);
      restoreCard(snapshot);
    }
  }
  // Checkbox toggle, updated optimistically so the box responds
  // instantly; a failure rolls back via reloadQueue + the error banner.
  // Without a known own id (no session), skip the guess and refetch.
  async function toggleMark(id) {
    setError(null);
    try {
      const res = await toggleImportant(id);
      if (!myId) {
        await reloadQueue();
        return;
      }
      const { important } = res.data;
      setItems((old) =>
        old.map((item) => {
          if (item._id !== id) return item;
          const marks = new Set(item.importantBy || []);
          if (important) marks.add(myId);
          else marks.delete(myId);
          return { ...item, importantBy: [...marks] };
        }),
      );
    } catch (err) {
      setError(err.message);
      await reloadQueue();
    }
  }
  // Retry state for failed generations (item ids with a retry in
  // flight). Fire-and-forget server-side, so the queue reloads on a
  // delay to pick up the fresh draft.
  const [retrying, setRetrying] = useState(() => new Set());
  async function retry(id) {
    if (retrying.has(id)) return;
    setError(null);
    try {
      await retryAnswer(id);
      setRetrying((old) => new Set(old).add(id));
      setTimeout(async () => {
        await reloadQueue();
        setRetrying((old) => {
          const next = new Set(old);
          next.delete(id);
          return next;
        });
      }, 25000);
    } catch (err) {
      setError(err.message);
    }
  }
  async function reject(id) {
    const note = window.prompt(
      'Optional note for the student (leave blank to use the default message):',
    );
    if (note === null) return; // they hit cancel
    const snapshot = await beatThenRemove(id, 'reject');
    if (!snapshot) return;
    setError(null);
    try {
      await rejectAnswer(id, note || undefined);
    } catch (err) {
      setError(err.message);
      restoreCard(snapshot);
    }
  }
  if (loading) {
    return <LoadingState message="Getting the review queue ready for you" />;
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
          <h1 className="mt-1 font-sans text-[36px] text-heading">
            Review Queue
          </h1>
          <p className="mt-2 text-[17px] text-body">
            Check drafted answers before they are published.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing || loading}
            className="rounded-xl border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots /> Refreshing
              </span>
            ) : (
              'Refresh ⟳'
            )}
          </button>
          <button
            onClick={() => onPageChange('ta-history')}
            className="rounded-xl border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
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
              ? 'border-border bg-surface text-white'
              : 'border-border bg-surface text-heading hover:bg-accent-hover'
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
                ? 'border-border bg-surface text-white'
                : 'border-border bg-surface text-heading hover:bg-accent-hover'
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
                ? 'border-border bg-white/5 text-heading'
                : 'border-border bg-surface text-body hover:bg-white/10'
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
                  ? 'border-border bg-white/5 text-heading'
                  : 'border-border bg-surface text-body hover:bg-white/10'
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
        <p className="mt-8 text-sm text-body">
          Nothing waiting on review here.
        </p>
      )}
      <div className="mt-8 space-y-5">
        {visibleItems.map((item) => {
          const mod = moduleById.get(item.moduleId);
          return (
            <div
              key={item._id}
              className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-body">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  {mod && (
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-body">
                      {mod.courseTitle} — {mod.title}
                    </span>
                  )}
                </div>
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.confidence !== null &&
                    item.confidence !== undefined &&
                    item.confidence < 0.65 && (
                      <span
                        title={`Retrieval confidence ${item.confidence} — shakiest drafts sort first`}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                      >
                        Low confidence
                      </span>
                    )}
                  {(item.waitingDays ?? 0) >= 2 && (
                    <span
                      title="Waiting over 48 hours"
                      className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600"
                    >
                      Waiting {item.waitingDays}d+
                    </span>
                  )}
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-body">
                    {item.status}
                  </span>
                </span>
              </div>
              <div className="p-6">
                <div className="text-[18px] font-semibold text-heading">
                  {item.question}
                </div>
                {/* No draft yet means one of two things — still
                    generating (no error recorded) or failed (error
                    recorded). One shared box confused both, so they split:
                    a live generating state vs an explicit failed state
                    with Retry. */}
                {!item.draftAnswer && !item.generationError && editingId !== item._id ? (
                  <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-border bg-white/5 p-4 text-sm text-body">
                    <LoadingDots />
                    <span>Generating answer… it will appear here when ready.</span>
                  </div>
                ) : null}
                {!item.draftAnswer && item.generationError && editingId !== item._id ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">
                      Answer generation failed
                      {item.generationAttempts > 1
                        ? ` (${item.generationAttempts} attempts)`
                        : ''}
                      .
                    </p>
                    {item.generationError && (
                      <p className="mt-1 text-xs text-red-600">
                        {item.generationError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => retry(item._id)}
                      disabled={retrying.has(item._id)}
                      className="mt-3 rounded-xl border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                    >
                      {retrying.has(item._id)
                        ? 'Retrying — fresh draft lands on refresh…'
                        : 'Retry generation'}
                    </button>
                  </div>
                ) : editingId === item._id ? (
                  <textarea
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    rows="5"
                    className="mt-4 w-full rounded-lg border border-border p-3 text-[15px] outline-none focus:border-accent"
                  />
                ) : (
                  <p className="mt-4 text-[15px] leading-6 text-body">
                    {item.draftAnswer}
                  </p>
                )}
                {/* Optional star rating — travels with the approval and
                    decides whether the answer teaches future drafts (3+,
                    or unrated) or is kept out (1–2). Hidden while there
                    is no draft to rate. */}
                {item.draftAnswer && (
                <div className="mt-5 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs font-medium uppercase tracking-wide text-body">
                    Rate
                  </span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      title={RATING_LABELS[star]}
                      aria-label={`Rate ${star} out of 5: ${RATING_LABELS[star]}`}
                      onClick={() => setRating(item._id, star)}

                      className={`text-xl leading-none transition-all duration-150 ease-out active:scale-90 disabled:opacity-60 ${
                        ratings[item._id] >= star
                          ? 'text-star'
                          : 'text-body/50 hover:text-star'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-1 text-xs text-body/70">
                    {ratings[item._id]
                      ? RATING_LABELS[ratings[item._id]]
                      : 'optional'}
                  </span>
                </div>
                )}
                {/* Important marker — one TA's toggle is one vote; enough
                    distinct-TA votes (threshold, currently 2) highlights
                    the question on the instructor portal. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ImportantButton
                    marked={(item.importantBy || []).includes(myId)}
                    count={item.importantBy?.length ?? 0}
                    onToggle={() => toggleMark(item._id)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.draftAnswer && editingId !== item._id ? (
                    // Failed draft: nothing to approve or edit — Retry
                    // lives above; Reject stays valid.
                    <button
                      onClick={() => reject(item._id)}
                      disabled={Boolean(pendingRemoval[item._id])}
                      className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                    >
                      {pendingRemoval[item._id] === 'reject'
                        ? 'Rejecting…'
                        : 'Reject'}
                    </button>
                  ) : editingId === item._id ? (
                    <>
                      <button
                        onClick={() =>
                          approve(item._id, answerText, ratings[item._id])
                        }
                        disabled={Boolean(pendingRemoval[item._id])}
                        className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                      >
                        {pendingRemoval[item._id] === 'approve'
                          ? 'Saving…'
                          : 'Save & approve'}
                      </button>
                      <button
                        onClick={cancelEditing}

                        className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
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
                        disabled={Boolean(pendingRemoval[item._id])}
                        className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                      >
                        {pendingRemoval[item._id] === 'approve'
                          ? 'Approving…'
                          : 'Approve'}
                      </button>
                      <button
                        onClick={() => startEditing(item)}

                        className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => reject(item._id)}
                        disabled={Boolean(pendingRemoval[item._id])}
                        className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                      >
                        {pendingRemoval[item._id] === 'reject'
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

