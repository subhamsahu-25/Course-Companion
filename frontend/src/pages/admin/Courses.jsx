// frontend/src/pages/admin/Courses.jsx
import { useState, useEffect } from 'react';
import { LoadingState } from '../../components/ui/primitives.jsx';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getMyModules,
} from '../../api/client.js';
export default function AdminCourses({ onPageChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Which course's code was just copied (icon-only button, no text) —
  // shows a brief "Copied" hint next to it.
  const [copiedId, setCopiedId] = useState(null);

  function CopyIcon({ className }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        fill="currentColor"
        className={className}
        aria-hidden
      >
        <path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z" />
      </svg>
    );
  }

  async function handleCopyCode(course, event) {
    event.stopPropagation();
    const code = course.joinCode || '';
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API needs a secure context — fallback for anything else.
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(course._id);
    setTimeout(() => {
      setCopiedId((id) => (id === course._id ? null : id));
    }, 1500);
  }
  useEffect(() => {
    loadCourses();
  }, []);
  async function loadCourses() {
    setLoading(true);
    try {
      const [coursesRes, modulesRes] = await Promise.all([
        getCourses(),
        getMyModules(),
      ]);
      const counts = {};
      for (const mod of modulesRes.data || []) {
        const cid = mod.course?._id || mod.course;
        counts[cid] = (counts[cid] || 0) + 1;
      }
      setCourses(
        coursesRes.data.map((course) => ({
          ...course,
          moduleCount: counts[course._id] || 0,
        })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function handleCreateCourse(event) {
    event.preventDefault();
    // Mirrors the backend rule (title: 3–100 chars) so a too-short name is
    // caught here instead of surfacing as a 422 after submit.
    if (newCourseTitle.trim().length < 3) return;
    setSubmitting(true);
    try {
      await createCourse(newCourseTitle);
      setNewCourseTitle('');
      setShowNewCourse(false);
      await loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function togglePublish(course, event) {
    event.stopPropagation(); // don't trigger the card's own onClick
    try {
      await updateCourse(course._id, { isPublished: !course.isPublished });
      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }
  async function handleDelete(course, event) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${course.title}"? This cannot be undone. Modules and documents inside it will not be deleted automatically.`,
    );
    if (!confirmed) return;
    try {
      await deleteCourse(course._id);
      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }
  if (loading) {
    return <LoadingState message="Getting the courses ready for you" />;
  }
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 font-sans text-[36px] text-heading">Courses</h1>
          <p className="mt-2 text-[17px] text-body">
            Manage the courses students and TAs can join.
          </p>
        </div>
        <button
          onClick={() => setShowNewCourse((s) => !s)}
          className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
        >
          + New course
        </button>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {showNewCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row"
        >
          <input
            type="text"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
            placeholder="Course title, min 3 characters (e.g. Electrical Engineering 101)"
            minLength={3}
            maxLength={100}
            className="flex-1 rounded-md border border-border p-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={submitting || newCourseTitle.trim().length < 3}
            className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {courses.length === 0 && (
          <p className="text-sm text-body">
            No courses yet — create one above to get started.
          </p>
        )}
        {courses.map((course) => (
          <div
            key={course._id}
            onClick={() =>
              onPageChange('admin-modules', { courseId: course._id })
            }
            className="cursor-pointer rounded-xl border border-border bg-white/5 p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-hover hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[19px] font-semibold text-heading">
                {course.title}
              </div>
              <button
                onClick={(e) => handleDelete(course, e)}
                className="shrink-0 text-xs text-red-400 hover:underline hover:opacity-80"
              >
                Delete
              </button>
            </div>
            {course.description && (
              <p className="mt-2 text-sm text-body">
                {course.description}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs text-body">
              Join code
              <span className="font-mono font-semibold tracking-[0.15em] text-heading">
                {course.joinCode}
              </span>
              <button
                type="button"
                onClick={(e) => handleCopyCode(course, e)}
                aria-label={`Copy join code ${course.joinCode}`}
                title={copiedId === course._id ? 'Copied!' : 'Copy join code'}
                className="flex items-center text-body transition-all duration-200 ease-out hover:text-heading hover:opacity-80 active:scale-90"
              >
                <CopyIcon className="size-4" />
              </button>
              {copiedId === course._id && (
                <span className="font-medium text-heading">Copied!</span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-body">
                {course.moduleCount} module
                {course.moduleCount !== 1 ? 's' : ''} →
              </span>
              <button
                onClick={(e) => togglePublish(course, e)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  course.isPublished
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {course.isPublished ? 'Published' : 'Draft — click to publish'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


