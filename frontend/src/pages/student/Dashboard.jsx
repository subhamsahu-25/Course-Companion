// frontend/src/pages/student/Dashboard.jsx
import { useState, useEffect } from 'react'
import { getCourses, getModulesByCourse, getStats } from '../../api/client.js'

const cardColors = ['#1D3557', '#457B9D', '#6C9BB5', '#8AAFC4']

export default function StudentDashboard({ onPageChange }) {
  const [courses, setCourses] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const [coursesRes, statsRes] = await Promise.all([
        getCourses(),
        getStats(),
      ])

      const withModuleCounts = await Promise.all(
        coursesRes.data.map(async (course, i) => {
          const modulesRes = await getModulesByCourse(course._id)
          return {
            id: course._id,
            name: course.title,
            moduleCount: modulesRes.data.length,
            color: cardColors[i % cardColors.length],
          }
        })
      )

      setCourses(withModuleCounts)
      setStats(statsRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading your dashboard...</p>
  }

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Student
        </div>

        <h1 className="mt-1 text-[34px] font-bold text-[#2B2D42]">
          Your Dashboard
        </h1>

        <p className="mt-1 text-[17px] text-[#647D8D]">
          Your courses and how your questions have been going.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
          <div className="rounded-xl border border-[#D9E1E7] bg-white p-4 text-center sm:p-5">
            <div className="text-[27px] font-bold text-[#1D3557]">
              {stats.total}
            </div>
            <div className="mt-1 text-xs text-[#647D8D] sm:text-sm">
              questions asked
            </div>
          </div>

          <div className="rounded-xl border border-[#D9E1E7] bg-white p-4 text-center sm:p-5">
            <div className="text-[27px] font-bold text-[#1D3557]">
              {stats.approved}
            </div>
            <div className="mt-1 text-xs text-[#647D8D] sm:text-sm">
              answered
            </div>
          </div>

          <div className="rounded-xl border border-[#D9E1E7] bg-white p-4 text-center sm:p-5">
            <div className="text-[27px] font-bold text-[#1D3557]">
              {stats.pending}
            </div>
            <div className="mt-1 text-xs text-[#647D8D] sm:text-sm">
              pending review
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {courses.length === 0 && (
          <p className="text-sm text-[#8AA0AE]">
            No courses available yet.
          </p>
        )}

        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() =>
              onPageChange('student-modules', { courseId: course.id })
            }
            className="rounded-2xl p-6 text-left text-white shadow-sm transition hover:-translate-y-0.5"
            style={{ backgroundColor: course.color }}
          >
            <div className="text-[21px] font-semibold">{course.name}</div>

            <p className="mt-2 text-[15px] text-white/85">
              {course.moduleCount} module
              {course.moduleCount !== 1 ? 's' : ''}
            </p>

            <div className="mt-5 text-sm text-white/80">
              Browse modules →
            </div>
          </button>
        ))}

        <button
          onClick={() => onPageChange('student-courses')}
          className="min-h-37.5 rounded-2xl border-2 border-dashed border-[#B7C8D3] bg-white p-6 text-center text-[17px] text-[#457B9D] transition hover:border-[#457B9D] hover:bg-[#F5F9FB]"
        >
          <div className="text-2xl">+</div>
          <div className="mt-2">Browse all courses</div>
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-5">
        <div className="text-[16px] font-semibold text-[#1D3557]">
          Quick note
        </div>

        <p className="mt-1 text-[15px] leading-6 text-[#647D8D]">
          Questions are reviewed by a teaching assistant before answers are
          published.
        </p>
      </div>
    </div>
  )
}
