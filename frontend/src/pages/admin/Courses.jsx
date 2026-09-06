// frontend/src/pages/admin/Courses.jsx
import { useState, useEffect } from 'react';
import {
  getCourses,
  createCourse,
  getModulesByCourse,
  updateCourse,
  deleteCourse, // 1. Added import
} from '../../api/courses';

export default function AdminCourses({ onPageChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null); // Track pending delete

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
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
    if (!newCourseTitle.trim()) return;

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

  async function togglePublish(course) {
    try {
      await updateCourse(course._id, { isPublished: !course.isPublished });
      await loadCourses();
    } catch (err) {
      setError(err.message);
    }
  }

  // 2. Delete Course Handler
  async function handleDeleteCourse(e, courseId, title) {
    e.stopPropagation(); // Stop navigation to modules view

    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}"? This will remove it from student and TA portals.`,
    );
    if (!confirmed) return;

    setDeletingId(courseId);
    try {
      await deleteCourse(courseId);
      // Instant UI removal
      setCourses((prev) => prev.filter((c) => c._id !== courseId));
    } catch (err) {
      setError(err.message || 'Failed to delete course');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading courses...</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
            Administration
          </div>

          <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
            Courses
          </h1>

          <p className="mt-2 text-[17px] text-[#647D8D]">
            Manage the courses students can browse.
          </p>
        </div>

        <button
          onClick={() => setShowNewCourse((s) => !s)}
          className="rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F]"
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
          className="mt-6 flex gap-3 rounded-xl border border-[#D9E1E7] bg-white p-4"
        >
          <input
            type="text"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
            placeholder="Course title (e.g. Electrical Engineering 101)"
            className="flex-1 rounded-md border border-[#C8D6DF] p-2.5 text-sm outline-none focus:border-[#457B9D]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#1D3557] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {courses.length === 0 && (
          <p className="text-sm text-[#8AA0AE]">
            No courses yet — create one above to get started.
          </p>
        )}

        {courses.map((course) => (
          <button
            key={course._id}
            onClick={() =>
              onPageChange('admin-modules', { courseId: course._id })
            }
            className="group relative flex flex-col justify-between rounded-xl border border-[#D9E1E7] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#457B9D] hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[19px] font-semibold text-[#2B2D42]">
                  {course.title}
                </div>

                {/* 3. Delete Action Button */}
                <button
                  type="button"
                  title="Delete course"
                  disabled={deletingId === course._id}
                  onClick={(e) =>
                    handleDeleteCourse(e, course._id, course.title)
                  }
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>

              {course.description && (
                <p className="mt-2 text-sm text-[#647D8D]">
                  {course.description}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-[#457B9D]">
                {course.moduleCount} module{course.moduleCount !== 1 ? 's' : ''}{' '}
                →
              </span>

              <span
                onClick={(e) => {
                  e.stopPropagation();
                  togglePublish(course);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  course.isPublished
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {course.isPublished ? 'Published' : 'Draft — click to publish'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
