// frontend/src/pages/student/History.jsx
import { useState, useEffect, useRef } from 'react';
import {
  getMyAnswer,
  getMyAnswers,
  getCourses,
  getModulesByCourse,
} from '../../api/client.js';
import { RATING_LABELS, formatRating } from '../../utils/rating.js';
import { LoadingDots } from '../../components/ui/primitives.jsx';
import { Select } from '../../components/ui/select.jsx';
const STATUS_LABELS = {
  pending: 'Awaiting TA review',
  approved: 'TA-reviewed answer',
  rejected: 'TA response',
};
// Builds the "Page 3" half of a citation tag pair — page only. Line
// numbers were dropped: chunk-overlap anchoring made them approximate,
// while page numbers come straight from the PDF structure and are exact.
// Returns null when the citation has no page (TA-verified answers) —
// those show the source tag alone.
function citationPage(citation) {
  return citation.page !== null && citation.page !== undefined
    ? `Page ${citation.page}`
    : null;
}
export default function StudentHistory({
  onPageChange,
  initialCourseId,
  initialModuleId,
}) {
  // One-shot context (Back-to-history, "view in history"): pre-selects
  // the course/module the student came from instead of starting blank.
  const appliedContext = useRef(false);
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
  useEffect(() => {
    if (
      appliedContext.current ||
      loadingCourses ||
      courses.length === 0 ||
      !initialCourseId ||
      !courses.some((c) => c._id === initialCourseId)
    ) {
      return;
    }
    appliedContext.current = true;
    handleCourseChange(initialCourseId).then(() => {
      if (initialModuleId) setSelectedModuleId(initialModuleId);
    });
  });
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
        const { status, answer, rating, citations } = res.data;
        if (status === 'pending') {
          pollForAnswer(requestId);
          return;
        }
        delete pollRefs.current[requestId];
        setAllAnswers((old) =>
          old.map((item) =>
            item.id === requestId
              ? { ...item, status, answer, rating, citations }
              : item,
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
        <h1 className="mt-1 font-sans text-[34px] text-heading">
          Question history
        </h1>
        <p className="mt-2 text-[17px] text-body">
          Pick a course and module to see everything you've asked there, and its
          review status.
        </p>
      </div>
      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <label htmlFor="course" className="text-sm font-medium text-heading">
          Course
        </label>
        <div className="mt-2">
          <Select
            value={selectedCourseId}
            onChange={(id) => handleCourseChange(id)}
            disabled={loadingCourses}
            ariaLabel="Course"
            placeholder={loadingCourses ? 'Loading courses…' : 'Select a course…'}
            options={courses.map((course) => ({
              id: course._id,
              label: course.title,
            }))}
          />
        </div>
        <label
          htmlFor="module"
          className="mt-4 block text-sm font-medium text-heading"
        >
          Module
        </label>
        <div className="mt-2">
          <Select
            value={selectedModuleId}
            onChange={(id) => setSelectedModuleId(id)}
            disabled={!selectedCourseId || loadingModules}
            ariaLabel="Module"
            placeholder={
              !selectedCourseId
                ? 'Select a course first'
                : loadingModules
                  ? 'Loading modules…'
                  : 'Select a module…'
            }
            options={modulesForCourse.map((mod) => ({
              id: mod._id,
              label: mod.title,
            }))}
          />
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-body">
            {selectedCourse && selectedModule
              ? `Questions — ${selectedCourse.title} / ${selectedModule.title}`
              : 'Your questions'}
          </h2>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-sm text-body hover:underline hover:opacity-80 disabled:opacity-60"
          >
            {loadingHistory ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots /> Refreshing
              </span>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {!selectedModuleId && (
            <p className="text-sm text-body">
              Select a course and module above to see your question history for
              it.
            </p>
          )}
          {selectedModuleId &&
            visibleHistory.length === 0 &&
            !loadingHistory && (
              <p className="text-sm text-body">
                Nothing asked in this module yet.{' '}
                <button
                  onClick={() =>
                    onPageChange('student-ask', { moduleId: selectedModuleId })
                  }
                  className="font-medium text-body hover:underline hover:opacity-80"
                >
                  Ask one
                </button>
              </p>
            )}
          {visibleHistory.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-white/5 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[18px] font-semibold text-heading">
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
                <p className="mt-3 text-[15px] leading-6 text-body italic">
                  Still being reviewed by a TA.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-[15px] leading-6 text-body">
                    {item.answer}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() =>
                        onPageChange('student-ask', {
                          courseId: item.courseId,
                          moduleId: item.moduleId,
                          threadId: item.threadId || item.id,
                          threadQuestion: item.question,
                          threadAnswer: item.answer,
                        })
                      }
                      className="rounded-xl border border-border bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98]"
                    >
                      Follow up →
                    </button>
                  </div>
                  {(() => {
                    // Golden (TA-written) citations carry no file or page —
                    // rendering them produces exactly the stray
                    // "TA-verified answer" pill, so only real document
                    // citations get tags.
                    const citation = (item.citations || []).find(
                      (c) => !c.golden,
                    );
                    if (!citation) return null;
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span
                          title={citation.source}
                          className="max-w-56 truncate rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-heading"
                        >
                          {citation.source}
                        </span>
                        {citationPage(citation) && (
                          <span className="rounded-full border border-border/60 bg-white/5 px-2.5 py-0.5 text-xs text-body">
                            {citationPage(citation)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {formatRating(item.rating) && (
                    <p
                      title={RATING_LABELS[item.rating]}
                      className="mt-2 text-xs font-medium text-star/90"
                    >
                      TA rating: {formatRating(item.rating)}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


