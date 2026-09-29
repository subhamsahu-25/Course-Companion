// frontend/src/pages/student/Courses.jsx
import { useState, useEffect } from 'react';
import { getCourses, getMyModules } from '../../api/client.js';
import { LoadingState } from '../../components/ui/primitives.jsx';
import { getStoredUid, cacheGet, cacheSet } from '../../utils/cache.js';

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

  // Stale-while-revalidate: cached catalog renders instantly (no
  // loading flash), then the network refreshes it underneath. Cache is
  // per-user and wiped on logout — see utils/cache.js.
  async function loadCourses() {
    const uid = getStoredUid();
    const cached = cacheGet(uid, 'courses');
    if (cached) setCourses(cached);
    else setLoading(true);
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

      const fresh = coursesRes.data.map((course) => ({
        ...course,
        moduleCount: counts[course._id] || 0,
      }));
      setCourses(fresh);
      cacheSet(uid, 'courses', fresh);
    } catch (err) {
      // A failed background refresh over a cache hit stays silent — the
      // stale list is already on screen. Only a cold failure surfaces.
      if (!cached) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingState message="Getting the courses ready for you" />;
  }

  return (
    <div>
      <div>

        <h1 className="mt-1 font-sans text-[36px] text-heading">Courses</h1>

        <p className="mt-2 text-[17px] text-body">
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
          <p className="text-sm text-body">
            No courses available yet. Join one, open any module, and hit
            Ask.
          </p>
        )}

        {courses.map((course) => (
          <button
            key={course._id}
            onClick={() => onPageChange(modulesPage, { courseId: course._id })}
            className="flex w-full flex-col gap-4 rounded-xl border border-border bg-white/5 p-5 text-left transition-all duration-200 ease-out hover:border-accent-hover sm:flex-row sm:items-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-xl text-accent-ink shadow-sm">
              📚
            </div>

            <div className="flex-1">
              <div className="text-[19px] font-semibold text-heading">
                {course.title}
              </div>

              {course.description && (
                <div className="mt-1 text-[15px] text-body">
                  {course.description}
                </div>
              )}

              <div className="mt-1 text-xs text-body">
                {course.moduleCount} module{course.moduleCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="shrink-0 text-lg text-body">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}

