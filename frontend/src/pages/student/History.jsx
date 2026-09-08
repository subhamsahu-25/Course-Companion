// frontend/src/pages/student/History.jsx
import { useState, useEffect, useRef } from 'react';
import {
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

export default function StudentHistory({ onPageChange }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [modulesForCourse, setModulesForCourse] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loadingModules, setLoadingModules] = useState(false);

  const [allAnswers, setAllAnswers] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState(null);

  // requestId -> timeout id, so pending items keep polling for a status
  // update without the student having to hit Refresh.
  const pollRefs = useRef({});

  useEffect(() => {
    loadCourses();
    loadHistory();
    return () => {
      Object.values(pollRefs.current).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    allAnswers.forEach((item) => {
      if (item.status === 'pending' && !pollRefs.current[item.id]) {
        pollForAnswer(item.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswers]);

  async function loadCourses() {
    setLoadingCourses(true);
    try {
      const res = await getCourses();
      setCourses(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCourses(false);
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

  // Modules only ever load for the currently selected course — the module
  // dropdown stays disabled and empty until a course is picked.
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

  function pollForAnswer(requestId) {
    pollRefs.current[requestId] = setTimeout(async () => {
      try {
        const res = await getMyAnswer(requestId);
        const { status, answer } = res.data;

        if (status === 'pending') {
          pollForAnswer(requestId);
          return;
        }

        delete pollRefs.current[requestId];
        setAllAnswers((old) =>
          old.map((item) =>
            item.id === requestId ? { ...item, status, answer } : item,
          ),
        );
      } catch {
        delete pollRefs.current[requestId];
      }
    }, 4000);
  }

  // Scoped to the exact module selected — nothing from other modules or
  // other courses leaks in.
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
          Your history
        </div>

        <h1 className="mt-1 font-serif text-[34px] text-[#1D3557]">
          Question history
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Pick a course and module to see everything you've asked there, and its
          review status.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-5 shadow-sm">
        <label htmlFor="course" className="text-sm font-medium text-[#2B2D42]">
          Course
        </label>

        <select
          id="course"
          value={selectedCourseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          disabled={loadingCourses}
          className="mt-2 w-full rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-3 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D] disabled:cursor-not-allowed disabled:bg-[#F1F4F6] disabled:text-[#9AAAB5]"
        >
          <option value="">
            {loadingCourses ? 'Loading courses…' : 'Select a course…'}
          </option>
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
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
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
                Nothing asked in this module yet.{' '}
                <button
                  onClick={() =>
                    onPageChange('student-ask', { moduleId: selectedModuleId })
                  }
                  className="font-medium text-[#457B9D] hover:underline"
                >
                  Ask one
                </button>
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
