// frontend/src/pages/student/Courses.jsx
import { useState, useEffect } from 'react'
import { getCourses, getModulesByCourse } from '../../api/client.js'

export default function StudentCourses({ onPageChange }) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadCourses()
  }, [])

  async function loadCourses() {
    setLoading(true)
    try {
      const coursesRes = await getCourses()

      const withModuleCounts = await Promise.all(
        coursesRes.data.map(async (course) => {
          const modulesRes = await getModulesByCourse(course._id)
          return { ...course, moduleCount: modulesRes.data.length }
        })
      )

      setCourses(withModuleCounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading courses...</p>
  }

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Course material
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
          Courses
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
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
          <p className="text-sm text-[#8AA0AE]">
            No courses available yet.
          </p>
        )}

        {courses.map((course) => (
          <button
            key={course._id}
            onClick={() =>
              onPageChange('student-modules', { courseId: course._id })
            }
            className="flex w-full flex-col gap-4 rounded-xl border border-[#C9D9E3] bg-[#E7F1F6] p-5 text-left transition hover:border-[#457B9D] sm:flex-row sm:items-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-xl text-[#457B9D] shadow-sm">
              📚
            </div>

            <div className="flex-1">
              <div className="text-[19px] font-semibold text-[#2B2D42]">
                {course.title}
              </div>

              {course.description && (
                <div className="mt-1 text-[15px] text-[#536F81]">
                  {course.description}
                </div>
              )}

              <div className="mt-1 text-xs text-[#7390A1]">
                {course.moduleCount} module
                {course.moduleCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="shrink-0 text-lg text-[#457B9D]">→</div>
          </button>
        ))}
      </div>
    </div>
  )
}
