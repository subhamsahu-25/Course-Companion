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
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#854F6C]">
          Ask a question
        </div>

        <h1 className="mt-1 font-sans text-[34px] text-[#2B124C]">
          Ask a question
        </h1>

        <p className="mt-2 text-[17px] text-[#854F6C]">
          Ask something about the course material.
        </p>
      </div>

      <form
        onSubmit={submitQuestion}
        className="mt-8 rounded-xl border border-[#DFB6B2] bg-white p-5 shadow-sm"
      >
        <label htmlFor="course" className="text-sm font-medium text-[#190019]">
          Course
        </label>

        <select
          id="course"
          value={selectedCourseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[#DFB6B2] bg-[#FFF9F4] p-3 text-[15px] text-[#190019] outline-none focus:border-[#854F6C]"
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
          className="mt-4 block text-sm font-medium text-[#190019]"
        >
          Module
        </label>

        <select
          id="module"
          value={selectedModuleId}
          onChange={(e) => setSelectedModuleId(e.target.value)}
          disabled={!selectedCourseId || loadingModules}
          className="mt-2 w-full rounded-lg border border-[#DFB6B2] bg-[#FFF9F4] p-3 text-[15px] text-[#190019] outline-none focus:border-[#854F6C] disabled:cursor-not-allowed disabled:bg-[#F1F4F6] disabled:text-[#9AAAB5]"
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
          className="mt-4 block text-sm font-medium text-[#190019]"
        >
          Your question
        </label>

        <textarea
          id="question"
          rows="5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question here..."
          className="mt-2 w-full resize-none rounded-lg border border-[#DFB6B2] bg-[#FFF9F4] p-4 text-[16px] text-[#190019] outline-none placeholder:text-[#854F6C] focus:border-[#854F6C]"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[#854F6C]">
            A TA reviews the answer before it is published.
          </span>

          <button
            type="submit"
            disabled={submitting || !question.trim() || !selectedModuleId}
            className="rounded-md bg-[#2B124C] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#522B5B] disabled:opacity-60"
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
        <div className="mt-4 rounded-lg border border-[#B8D5E4] bg-[#EAF4F8] p-4 text-sm text-[#2B124C]">
          Your question was submitted to the TA review queue.{' '}
          {onPageChange && (
            <button
              onClick={() =>
                onPageChange('student-history', { moduleId: selectedModuleId })
              }
              className="font-medium text-[#854F6C] hover:underline"
            >
              View it in your history
            </button>
          )}
        </div>
      )}
    </div>
  );
}
