import { useEffect, useState } from 'react';
import {
  getReviewQueue,
  approveAnswer,
  rejectAnswer,
  getCourses,
  getModulesByCourse,
} from '../../api/client.js';

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
  const [actioningId, setActioningId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [queueRes, coursesRes] = await Promise.all([
        getReviewQueue(),
        getCourses(),
      ]);
      setItems(queueRes.data);
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

  async function approve(id, editedAnswer) {
    setActioningId(id);
    setError(null);
    try {
      await approveAnswer(id, editedAnswer);
      setEditingId(null);
      setAnswerText('');
      await reloadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  async function reject(id) {
    const note = window.prompt(
      'Optional note for the student (leave blank to use the default message):',
    );
    if (note === null) return; // they hit cancel

    setActioningId(id);
    setError(null);
    try {
      await rejectAnswer(id, note || undefined);
      await reloadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading review queue...</p>;
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
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
            Teaching Assistant
          </div>

          <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
            Review Queue
          </h1>

          <p className="mt-2 text-[17px] text-[#647D8D]">
            Check drafted answers before they are published.
          </p>
        </div>

        <button
          onClick={() => onPageChange('ta-history')}
          className="shrink-0 rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm font-medium text-[#1D3557] hover:bg-[#F5F8FA]"
        >
          View history →
        </button>
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
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
            selectedCourseId === ''
              ? 'border-[#1D3557] bg-[#1D3557] text-white'
              : 'border-[#C8D6DF] bg-white text-[#2B2D42] hover:bg-[#F5F8FA]'
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
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              selectedCourseId === course._id
                ? 'border-[#1D3557] bg-[#1D3557] text-white'
                : 'border-[#C8D6DF] bg-white text-[#2B2D42] hover:bg-[#F5F8FA]'
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
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedModuleId === ''
                ? 'border-[#457B9D] bg-[#E7F1F6] text-[#1D3557]'
                : 'border-[#D9E1E7] bg-white text-[#647D8D] hover:bg-[#F5F8FA]'
            }`}
          >
            All modules
          </button>

          {modulesForSelectedCourse.map((mod) => (
            <button
              key={mod._id}
              onClick={() => setSelectedModuleId(mod._id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedModuleId === mod._id
                  ? 'border-[#457B9D] bg-[#E7F1F6] text-[#1D3557]'
                  : 'border-[#D9E1E7] bg-white text-[#647D8D] hover:bg-[#F5F8FA]'
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
        <p className="mt-8 text-sm text-[#8AA0AE]">
          Nothing waiting on review here.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {visibleItems.map((item) => {
          const mod = moduleById.get(item.moduleId);

          return (
            <div
              key={item._id}
              className="overflow-hidden rounded-xl border border-[#D9E1E7] bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#E7F1F6] px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#457B9D]">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>

                  {mod && (
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-[#457B9D]">
                      {mod.courseTitle} — {mod.title}
                    </span>
                  )}
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-xs text-[#457B9D]">
                  {item.status}
                </span>
              </div>

              <div className="p-6">
                <div className="text-[18px] font-semibold text-[#2B2D42]">
                  {item.question}
                </div>

                {editingId === item._id ? (
                  <textarea
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    rows="5"
                    className="mt-4 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
                  />
                ) : (
                  <p className="mt-4 text-[15px] leading-6 text-[#354F61]">
                    {item.draftAnswer}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {editingId === item._id ? (
                    <>
                      <button
                        onClick={() => approve(item._id, answerText)}
                        disabled={actioningId === item._id}
                        className="rounded-md bg-[#457B9D] px-4 py-2 text-sm text-white hover:bg-[#386B89] disabled:opacity-60"
                      >
                        {actioningId === item._id
                          ? 'Saving…'
                          : 'Save & approve'}
                      </button>

                      <button
                        onClick={cancelEditing}
                        disabled={actioningId === item._id}
                        className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => approve(item._id)}
                        disabled={actioningId === item._id}
                        className="rounded-md bg-[#1D3557] px-4 py-2 text-sm text-white hover:bg-[#28476F] disabled:opacity-60"
                      >
                        {actioningId === item._id ? 'Approving…' : 'Approve'}
                      </button>

                      <button
                        onClick={() => startEditing(item)}
                        disabled={actioningId === item._id}
                        className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => reject(item._id)}
                        disabled={actioningId === item._id}
                        className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                      >
                        {actioningId === item._id ? 'Rejecting…' : 'Reject'}
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
