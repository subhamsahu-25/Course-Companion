// frontend/src/pages/admin/Courses.jsx
import { useState, useEffect } from 'react';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getModulesByCourse,
} from '../../api/client.js';

export default function AdminCourses({ onPageChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The course object just returned by createCourse, shown once so the
  // admin can grab its join code before it scrolls off into the grid
  // below with everything else.
  const [justCreated, setJustCreated] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    setLoading(true);
    try {
      const coursesRes = await getCourses();

      const withModuleCounts = await Promise.all(
        coursesRes.data.map(async (course) => {
          const modulesRes = await getModulesByCourse(course._id);
          return { ...course, moduleCount: modulesRes.data.length };
        }),
      );

      setCourses(withModuleCounts);
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
      const res = await createCourse(newCourseTitle);
      setJustCreated(res.data);
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

      if (justCreated?._id === course._id) {
        setJustCreated(null);
      }

      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#854F6C]">Loading courses...</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#854F6C]">
            Administration
          </div>

          <h1 className="mt-1 font-sans text-[36px] text-[#2B124C]">
            Courses
          </h1>

          <p className="mt-2 text-[17px] text-[#854F6C]">
            Manage the courses students and TAs can join.
          </p>
        </div>

        <button
          onClick={() => setShowNewCourse((s) => !s)}
          className="rounded-md bg-[#2B124C] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#522B5B]"
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
          className="mt-6 flex flex-col gap-3 rounded-xl border border-[#DFB6B2] bg-white p-4 sm:flex-row"
        >
          <input
            type="text"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
            placeholder="Course title, min 3 characters (e.g. Electrical Engineering 101)"
            minLength={3}
            maxLength={100}
            className="flex-1 rounded-md border border-[#DFB6B2] p-2.5 text-sm outline-none focus:border-[#854F6C]"
          />
          <button
            type="submit"
            disabled={submitting || newCourseTitle.trim().length < 3}
            className="rounded-md bg-[#2B124C] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}

      {justCreated && (
        <div className="mt-6 flex flex-col items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-green-800">
              "{justCreated.title}" was created. Share this code with its
              students and TAs so they can join:
            </div>
            <div className="mt-1 text-[26px] font-semibold tracking-[0.3em] text-green-900">
              {justCreated.joinCode}
            </div>
          </div>

          <button
            onClick={() => setJustCreated(null)}
            className="text-sm text-green-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {courses.length === 0 && (
          <p className="text-sm text-[#854F6C]">
            No courses yet — create one above to get started.
          </p>
        )}

        {courses.map((course) => (
          <div
            key={course._id}
            onClick={() =>
              onPageChange('admin-modules', { courseId: course._id })
            }
            className="cursor-pointer rounded-xl border border-[#DFB6B2] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#854F6C] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[19px] font-semibold text-[#190019]">
                {course.title}
              </div>

              <button
                onClick={(e) => handleDelete(course, e)}
                className="shrink-0 text-xs text-[#B4636A] hover:underline"
              >
                Delete
              </button>
            </div>

            {course.description && (
              <p className="mt-2 text-sm text-[#854F6C]">
                {course.description}
              </p>
            )}

            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#F1F4F6] px-2.5 py-1 text-xs text-[#854F6C]">
              Join code
              <span className="font-mono font-semibold tracking-[0.15em] text-[#2B124C]">
                {course.joinCode}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-[#854F6C]">
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
