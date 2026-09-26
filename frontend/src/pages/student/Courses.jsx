// frontend/src/pages/student/Courses.jsx
import { useState, useEffect } from 'react';
import { getCourses, getMyModules } from '../../api/client.js';

export default function StudentCourses({
  onPageChange,
  modulesPage = 'student-modules',
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
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

  if (loading) {
    return <p className="text-sm text-[#80aad3]">Loading courses...</p>;
  }

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
          Course material
        </div>

        <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">Courses</h1>

        <p className="mt-2 text-[17px] text-[#80aad3]">
          Browse a course to see its modules.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {courses.length === 0 && !error && (
          <p className="text-sm text-[#80aad3]">No courses available yet.</p>
        )}

        {courses.map((course) => (
          <button
            key={course._id}
            onClick={() => onPageChange(modulesPage, { courseId: course._id })}
            className="flex w-full flex-col gap-4 rounded-xl border border-[#3f6593] bg-white/5 p-5 text-left transition-all duration-200 ease-out hover:border-[#5b86b6] sm:flex-row sm:items-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#3f6593] text-xl text-[#c0e6fd] shadow-sm">
              📚
            </div>

            <div className="flex-1">
              <div className="text-[19px] font-semibold text-[#c0e6fd]">
                {course.title}
              </div>

              {course.description && (
                <div className="mt-1 text-[15px] text-[#80aad3]">
                  {course.description}
                </div>
              )}

              <div className="mt-1 text-xs text-[#5b86b6]">
                {course.moduleCount} module{course.moduleCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="shrink-0 text-lg text-[#80aad3]">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}

