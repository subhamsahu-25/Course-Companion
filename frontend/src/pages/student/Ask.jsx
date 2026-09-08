// frontend/src/pages/student/Ask.jsx
import { useState, useEffect, useRef } from 'react';
import {
  askQuestion,
  getMyAnswer,
  getMyAnswers,
  getCourses,
  getModulesByCourse,
} from '../../api/client.js';

const STATUS_LABELS = {
  pending: 'Awaiting TA review',
  approved: 'TA-reviewed answer',
  rejected: 'TA response',
};

export default function StudentAsk({ initialModuleId }) {
  const [question, setQuestion] = useState('');

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [modulesForCourse, setModulesForCourse] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loadingModules, setLoadingModules] = useState(false);

  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // The full, unfiltered history from the backend. What's actually shown
  // on screen is derived from this + the current course/module selection —
  // see `visibleHistory` below.
  const [allAnswers, setAllAnswers] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const pollRef = useRef(null);

  useEffect(() => {
    loadCourses();
    loadHistory();
    return () => clearTimeout(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCourses() {
    try {
      const res = await getCourses();
      setCourses(res.data);

      // If we arrived here already knowing which module to ask about
      // (e.g. clicked "Ask" from a specific module's page), figure out
      // which course it belongs to so both dropdowns come pre-filled
      // instead of making the student pick again.
      if (initialModuleId) {
        for (const course of res.data) {
          const modulesRes = await getModulesByCourse(course._id);
          const match = modulesRes.data.find((m) => m._id === initialModuleId);
          if (match) {
            setSelectedCourseId(course._id);
            setModulesForCourse(modulesRes.data);
            setSelectedModuleId(initialModuleId);
            break;
          }
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // Modules are only ever loaded for the currently selected course — the
  // module dropdown has nothing to show, and is disabled, until a course
  // is picked.
  async function handleCourseChange(courseId) {
    setSelectedCourseId(courseId);
    setSelectedModuleId('');
    setModulesForCourse([]);

    if (!courseId) return;

    setLoadingModules(true);
    try {
      const res = await getModulesByCourse(courseId);
      setModulesForCourse(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingModules(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await getMyAnswers();
      setAllAnswers(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Updates one item in place once it's answered, rather than appending —
  // the optimistic "pending" entry added in submitQuestion already holds
  // this question's spot in the list.
  function pollForAnswer(requestId) {
    getMyAnswer(requestId)
      .then((res) => {
        const { status, answer } = res.data;

        if (status === 'pending') {
          pollRef.current = setTimeout(() => pollForAnswer(requestId), 4000);
          return;
        }

        setAllAnswers((old) =>
          old.map((item) =>
            item.id === requestId ? { ...item, status, answer } : item,
          ),
        );
      })
      .catch(() => {
        // if a lookup fails mid-poll, stop trying rather than looping forever
      });
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (!question.trim() || !selectedModuleId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await askQuestion(question, selectedModuleId);
      const { request_id } = res.data;

      // Show it in the history immediately as pending, scoped to the
      // module it was actually asked about, instead of waiting on the
      // first poll tick or a manual refresh.
      setAllAnswers((old) => [
        {
          id: request_id,
          moduleId: selectedModuleId,
          question,
          status: 'pending',
          answer: null,
          createdAt: new Date().toISOString(),
        },
        ...old,
      ]);

      setSent(true);
      pollForAnswer(request_id);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Strictly scoped: only questions asked about the exact module currently
  // selected. Nothing from other modules, even in the same course, and
  // nothing from other courses.
  const visibleHistory = selectedModuleId
    ? allAnswers.filter((item) => item.moduleId === selectedModuleId)
    : [];

  const selectedCourse = courses.find((c) => c._id === selectedCourseId);
  const selectedModule = modulesForCourse.find(
    (m) => m._id === selectedModuleId,
  );

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Ask a question
        </div>

        <h1 className="mt-1 font-serif text-[34px] text-[#1D3557]">
          Ask a question
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Ask something about the course material.
        </p>
      </div>

      <form
        onSubmit={submitQuestion}
        className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-5 shadow-sm"
      >
        <label htmlFor="course" className="text-sm font-medium text-[#2B2D42]">
          Course
        </label>

        <select
          id="course"
          value={selectedCourseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-3 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D]"
        >
          <option value="">Select a course…</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>
              {course.title}
            </option>
          ))}
        </select>

        <label
          htmlFor="module"
          className="mt-4 block text-sm font-medium text-[#2B2D42]"
        >
          Module
        </label>

        <select
          id="module"
          value={selectedModuleId}
          onChange={(e) => setSelectedModuleId(e.target.value)}
          disabled={!selectedCourseId || loadingModules}
          className="mt-2 w-full rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-3 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D] disabled:cursor-not-allowed disabled:bg-[#F1F4F6] disabled:text-[#9AAAB5]"
        >
          {!selectedCourseId && <option value="">Select a course first</option>}
          {selectedCourseId && loadingModules && (
            <option value="">Loading modules…</option>
          )}
          {selectedCourseId && !loadingModules && (
            <>
              <option value="">Select a module…</option>
              {modulesForCourse.map((mod) => (
                <option key={mod._id} value={mod._id}>
                  {mod.title}
                </option>
              ))}
            </>
          )}
        </select>

        <label
          htmlFor="question"
          className="mt-4 block text-sm font-medium text-[#2B2D42]"
        >
          Your question
        </label>

        <textarea
          id="question"
          rows="5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question here..."
          className="mt-2 w-full resize-none rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-4 text-[16px] text-[#2B2D42] outline-none placeholder:text-[#8AA0AE] focus:border-[#457B9D]"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[#647D8D]">
            A TA reviews the answer before it is published.
          </span>

          <button
            type="submit"
            disabled={submitting || !question.trim() || !selectedModuleId}
            className="rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F] disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit question'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {sent && (
        <div className="mt-4 rounded-lg border border-[#B8D5E4] bg-[#EAF4F8] p-4 text-sm text-[#1D3557]">
          Your question was submitted to the TA review queue. It'll appear below
          once reviewed.
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#457B9D]">
            {selectedCourse && selectedModule
              ? `Questions — ${selectedCourse.title} / ${selectedModule.title}`
              : 'Your questions'}
          </h2>

          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-sm text-[#457B9D] hover:underline disabled:opacity-60"
          >
            {loadingHistory ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {!selectedModuleId && (
            <p className="text-sm text-[#8AA0AE]">
              Select a course and module above to see your question history for
              it.
            </p>
          )}

          {selectedModuleId &&
            visibleHistory.length === 0 &&
            !loadingHistory && (
              <p className="text-sm text-[#8AA0AE]">
                Nothing asked in this module yet — ask a question above.
              </p>
            )}

          {visibleHistory.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[#C9D9E3] bg-[#E7F1F6] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[18px] font-semibold text-[#2B2D42]">
                  {item.question}
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    item.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : item.status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>

              {item.status === 'pending' ? (
                <p className="mt-3 text-[15px] leading-6 text-[#647D8D] italic">
                  Still being reviewed by a TA.
                </p>
              ) : (
                <p className="mt-3 text-[15px] leading-6 text-[#354F61]">
                  {item.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
