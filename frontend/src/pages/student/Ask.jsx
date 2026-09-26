// frontend/src/pages/student/Ask.jsx
import { useState, useEffect } from 'react';
import {
  askQuestion,
  getCourses,
  getModulesByCourse,
} from '../../api/client.js';
export default function StudentAsk({ initialModuleId, onPageChange }) {
  const [question, setQuestion] = useState('');
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [modulesForCourse, setModulesForCourse] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(
    initialModuleId || '',
  );
  const [loadingModules, setLoadingModules] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadCourses();
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
  async function submitQuestion(event) {
    event.preventDefault();
    if (!question.trim() || !selectedModuleId) return;
    setSubmitting(true);
    setError(null);
    setSent(false);
    try {
      await askQuestion(question, selectedModuleId);
      setSent(true);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
          Ask a question
        </div>
        <h1 className="mt-1 font-sans text-[34px] text-[#c0e6fd]">
          Ask a question
        </h1>
        <p className="mt-2 text-[17px] text-[#80aad3]">
          Ask something about the course material.
        </p>
      </div>
      <form
        onSubmit={submitQuestion}
        className="mt-8 rounded-xl border border-[#3f6593] bg-[#1b3554] p-5 shadow-sm"
      >
        <label htmlFor="course" className="text-sm font-medium text-[#c0e6fd]">
          Course
        </label>
        <select
          id="course"
          value={selectedCourseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[#3f6593] bg-[#000f22] p-3 text-[15px] text-[#c0e6fd] outline-none focus:border-[#5b86b6]"
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
          className="mt-4 block text-sm font-medium text-[#c0e6fd]"
        >
          Module
        </label>
        <select
          id="module"
          value={selectedModuleId}
          onChange={(e) => setSelectedModuleId(e.target.value)}
          disabled={!selectedCourseId || loadingModules}
          className="mt-2 w-full rounded-lg border border-[#3f6593] bg-[#000f22] p-3 text-[15px] text-[#c0e6fd] outline-none focus:border-[#5b86b6] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-[#80aad3]/60"
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
          className="mt-4 block text-sm font-medium text-[#c0e6fd]"
        >
          Your question
        </label>
        <textarea
          id="question"
          rows="5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question here..."
          className="mt-2 w-full resize-none rounded-lg border border-[#3f6593] bg-[#000f22] p-4 text-[16px] text-[#c0e6fd] outline-none placeholder:text-[#80aad3] focus:border-[#5b86b6]"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[#80aad3]">
            A TA reviews the answer before it is published.
          </span>
          <button
            type="submit"
            disabled={submitting || !question.trim() || !selectedModuleId}
            className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60"
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
        <div className="mt-4 rounded-lg border border-[#3f6593] bg-[#1b3554] p-4 text-sm text-[#c0e6fd]">
          Your question was submitted to the TA review queue.{' '}
          {onPageChange && (
            <button
              onClick={() =>
                onPageChange('student-history', { moduleId: selectedModuleId })
              }
              className="font-medium text-[#80aad3] hover:underline hover:opacity-80"
            >
              View it in your history
            </button>
          )}
        </div>
      )}
    </div>
  );
}


