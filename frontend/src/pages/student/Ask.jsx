// frontend/src/pages/student/Ask.jsx
import { useState, useEffect, useRef } from 'react';
import {
  askQuestion,
  getCourses,
  getModulesByCourse,
  getMyModules,
  getRelatedQuestions,
} from '../../api/client.js';
import ThreadChat from '../../components/ThreadChat.jsx';
import { LoadingDots } from '../../components/ui/primitives.jsx';
import { Select } from '../../components/ui/select.jsx';
export default function StudentAsk({ initialModuleId, initialThread, onPageChange }) {
  // Follow-up mode renders the chatbot thread instead of the ask form —
  // the thread's module carries the scope, so no dropdowns needed.
  const threadMode = Boolean(initialThread?.threadId);
  const [question, setQuestion] = useState('');
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [modulesForCourse, setModulesForCourse] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(
    initialModuleId || '',
  );
  const [loadingModules, setLoadingModules] = useState(false);
  const [sent, setSent] = useState(false);
  const [autoServed, setAutoServed] = useState(false);
  const [threadAnswer, setThreadAnswer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // 1-second "Sent ✓" dissolve on the button after click — acknowledgement
  // without blocking. Timer cleared on unmount so no late setState.
  const [flashSent, setFlashSent] = useState(false);
  const flashTimer = useRef(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
  function flashButton() {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashSent(true);
    flashTimer.current = setTimeout(() => setFlashSent(false), 1000);
  }
  // Live related verified answers as the student types — same scope as
  // the pending submission. Debounced so typing doesn't fan out into a
  // request per keystroke.
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const relatedTimer = useRef(null);
  // All state updates live inside the timeout callback — updating state
  // synchronously in the effect body trips purity lint and fires per
  // keystroke instead of per pause.
  useEffect(() => {
    if (relatedTimer.current) clearTimeout(relatedTimer.current);
    relatedTimer.current = setTimeout(async () => {
      const text = question.trim();
      if (text.length < 10 || !selectedModuleId) {
        setRelated([]);
        setLoadingRelated(false);
        return;
      }
      setLoadingRelated(true);
      try {
        const res = await getRelatedQuestions(selectedModuleId, text);
        setRelated(res.data || []);
      } catch {
        setRelated([]);
      } finally {
        setLoadingRelated(false);
      }
    }, 600);
    return () => {
      if (relatedTimer.current) clearTimeout(relatedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, selectedModuleId]);
  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function loadCourses() {
    try {
      const [coursesRes, modulesRes] = await Promise.all([
        getCourses(),
        getMyModules(),
      ]);
      setCourses(coursesRes.data);
      const flat = modulesRes.data || [];
      // If we arrived here already knowing which module to ask about
      // (e.g. clicked "Ask" from a specific module's page), figure out
      // which course it belongs to so both dropdowns come pre-filled
      // instead of making the student pick again.
      if (initialModuleId) {
        const match = flat.find((m) => m._id === initialModuleId);
        if (match) {
          const cid = match.course?._id || match.course;
          setSelectedCourseId(cid);
          setModulesForCourse(
            flat.filter((m) => (m.course?._id || m.course) === cid),
          );
          setSelectedModuleId(initialModuleId);
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
  // Optimistic submit: the form clears and confirms instantly while the
  // request runs in the background — the student is never stuck on
  // "Submitting…". A failure restores the exact text so nothing is lost.
  // Synchronous in-flight guard: the `submitting` state above updates on
  // re-render, so a rapid double-click could slip past it and file the
  // same question twice. The ref flips instantly in the same tick.
  const submittingRef = useRef(false);
  async function submitQuestion(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || !selectedModuleId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setQuestion('');
    setSent(true);
    setAutoServed(false);
    setThreadAnswer(null);
    flashButton();
    try {
      const res = await askQuestion(text, selectedModuleId, initialThread?.threadId);
      setAutoServed(res.data?.autoServed === true);
      // Direct follow-up answers render inline — no history trip needed.
      setThreadAnswer(res.data?.threadAnswered ? res.data?.answer || null : null);
    } catch (err) {
      setError(err.message);
      setQuestion(text);
      setSent(false);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  return (
    <div>
      <div>
        {threadMode && (
          <button
            onClick={() =>
              onPageChange &&
              onPageChange('student-history', {
                courseId: initialThread.courseId,
                moduleId: initialThread.moduleId,
              })
            }
            className="mb-3 rounded-md border border-border px-3 py-1.5 text-sm text-body transition-all duration-200 ease-out hover:bg-white/10 hover:text-heading hover:opacity-80 active:scale-[0.99]"
          >
            ← Back to history
          </button>
        )}
        <h1 className="mt-1 font-sans text-[34px] text-heading">
          {threadMode ? 'Ask follow-up questions' : 'Ask a question'}
        </h1>
        <p className="mt-2 text-[17px] text-body">
          {threadMode
            ? 'Continue the conversation — answers land right here.'
            : 'Ask something about the course material.'}
        </p>
      </div>
      {threadMode && (
        <ThreadChat
          thread={{
            threadId: initialThread.threadId,
            moduleId: initialThread.moduleId || selectedModuleId,
          }}
        />
      )}
      {!threadMode && (
      <>
      <form
        onSubmit={submitQuestion}
        className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        {/* Follow-up mode: thread context above carries the scope — no
            course/module picking, straight to the question box. */}
        {!initialThread?.threadId && (
          <>
            <label htmlFor="course" className="text-sm font-medium text-heading">
              Course
            </label>
            <div className="mt-2">
              <Select
                value={selectedCourseId}
                onChange={(id) => handleCourseChange(id)}
                ariaLabel="Course"
                placeholder="Select a course…"
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
          </>
        )}
        <label
          htmlFor="question"
          className="mt-4 block text-sm font-medium text-heading"
        >
          Your question
        </label>
        <textarea
          id="question"
          rows="5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question here..."
          className="mt-2 w-full resize-none rounded-lg border border-border bg-bg p-4 text-[16px] text-heading outline-none placeholder:text-body focus:border-accent"
        />
        {(loadingRelated || related.length > 0) && (
          <div className="mt-3 rounded-lg border border-border bg-bg p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-body">
              {loadingRelated && <LoadingDots />}
              {loadingRelated
                ? 'Searching verified answers for you'
                : 'Already answered — no need to submit'}
            </div>
            {!loadingRelated && (
              <ul className="mt-2 space-y-3">
                {related.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <div className="text-sm font-semibold text-heading">
                      {item.question}
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-body">
                      {item.answer}
                      {item.answer?.length >= 220 ? '…' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-body">
            A TA reviews the answer before it is published.
          </span>
          <button
            type="submit"
            disabled={submitting || !question.trim() || !selectedModuleId}
            className={`rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition-all duration-1000 ease-out active:scale-[0.98] disabled:opacity-60 ${
              flashSent
                ? 'bg-green-600 text-white'
                : 'bg-accent text-accent-ink hover:bg-accent-hover'
            }`}
          >
            {flashSent ? 'Sent ✓' : submitting ? 'Submitting...' : 'Submit question'}
          </button>
        </div>
      </form>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {sent && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-heading">
          {autoServed
            ? 'Answered instantly from a verified answer. '
            : threadAnswer
              ? ''
              : 'Your question was submitted to the TA review queue. '}
          {threadAnswer && (
            <p className="mt-1 text-[15px] leading-6 text-body">{threadAnswer}</p>
          )}
          {onPageChange && (
            <button
              onClick={() =>
                onPageChange('student-history', {
                  courseId: selectedCourseId,
                  moduleId: selectedModuleId,
                })
              }
              className="font-medium text-body hover:underline hover:opacity-80"
            >
              View it in your history
            </button>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}


