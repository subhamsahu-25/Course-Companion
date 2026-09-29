// frontend/src/pages/admin/Roster.jsx — member management, moved out of
// the course page into its own sidebar sections. One component, two
// modes: kind="students" (Manage students) and kind="tas" (Manage TAs).
// Flow: pick a course from the dropdown → roster renders as
// Name | Roll no. | Asked/Solved count | Delete button. Counts come from
// the Q&A stats endpoint; deletion is optimistic with rollback.
import { useEffect, useState } from 'react';
import {
  getCourses,
  getCourseById,
  getCourseQaStats,
  removeCourseMember,
} from '../../api/client.js';
import { ConfirmDialog } from '../../components/ui/primitives.jsx';
import { Select } from '../../components/ui/select.jsx';

const KIND = {
  students: {
    title: 'Manage students',
    subtitle: 'Enrolled students per course, with questions asked.',
    countLabel: 'Questions asked',
    emptyRoster: 'Nobody here yet — members appear once they join with the course code.',
  },
  tas: {
    title: 'Manage TAs',
    subtitle: 'Teaching assistants per course, with reviews resolved.',
    countLabel: 'Reviews resolved',
    emptyRoster: 'No TAs yet — TAs appear once they join with the course code.',
  },
};

export default function Roster({ kind }) {
  const config = KIND[kind] || KIND.students;
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [members, setMembers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState(null);
  // { title, message, run } | null — custom confirm, no browser dialog.
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCourses(true);
    getCourses()
      .then((res) => {
        if (!cancelled) setCourses(res.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadRoster(courseId) {
    if (!courseId) {
      setMembers([]);
      setCounts({});
      return;
    }
    setLoadingRoster(true);
    setError(null);
    try {
      const [courseRes, statsRes] = await Promise.all([
        getCourseById(courseId),
        getCourseQaStats(courseId).catch(() => null),
      ]);
      const course = courseRes.data;
      const list = kind === 'students' ? course?.students || [] : course?.tas || [];
      // Ascending roll-no. order; members without one sink to the bottom.
      const sorted = [...list].sort((a, b) => {
        if (!a.rollNo && !b.rollNo) return 0;
        if (!a.rollNo) return 1;
        if (!b.rollNo) return -1;
        return String(a.rollNo).localeCompare(String(b.rollNo), undefined, {
          numeric: true,
        });
      });
      setMembers(sorted);
      const byId = {};
      const rows = kind === 'students' ? statsRes?.data?.asked || [] : statsRes?.data?.reviewed || [];
      for (const row of rows) {
        byId[row.studentId || row.taId] = row.count;
      }
      setCounts(byId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRoster(false);
    }
  }

  function handleCourseChange(courseId) {
    setSelectedCourseId(courseId);
    loadRoster(courseId);
  }

  async function runConfirm() {
    const action = confirm?.run;
    setConfirm(null);
    if (action) await action();
  }

  function askRemove(member) {
    setConfirm({
      title: `Remove ${member.fullName || member.username} ?`,
      message: 'This cannot be reverted back.',
      run: async () => {
        const previous = members;
        setMembers((old) => old.filter((m) => m._id !== member._id));
        try {
          await removeCourseMember(selectedCourseId, member._id);
        } catch (err) {
          setMembers(previous);
          setError(err.message);
        }
      },
    });
  }

  return (
    <div>
      <div>
        <h1 className="mt-1 font-sans text-[36px] text-heading">{config.title}</h1>
        <p className="mt-2 text-[17px] text-body">{config.subtitle}</p>
      </div>

      <div className="mt-8 max-w-xl">
        <Select
          value={selectedCourseId}
          onChange={(id) => handleCourseChange(id)}
          disabled={loadingCourses}
          ariaLabel="Course"
          placeholder={loadingCourses ? 'Loading courses…' : 'Select a course…'}
          options={courses.map((course) => ({
            id: course._id,
            label: course.title,
          }))}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedCourseId && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          {loadingRoster ? (
            <p className="mt-3 text-sm text-body">Loading roster…</p>
          ) : members.length === 0 ? (
            <p className="mt-3 text-sm text-body">{config.emptyRoster}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-body">
                    <th className="px-2 py-2 font-medium">Serial No.</th>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Roll no.</th>
                    <th className="px-2 py-2 font-medium">
                      {kind === 'students' ? 'Questions asked' : 'Reviews resolved'}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, index) => (
                    <tr
                      key={m._id}
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="px-2 py-2.5 font-mono text-body">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2.5 text-heading">
                        {m.fullName || m.username}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-body">
                        {m.rollNo || '—'}
                      </td>
                      <td className="px-2 py-2.5 text-body">
                        {counts[m._id] ?? 0}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => askRemove(m)}
                          className="text-xs text-red-400/70 hover:text-red-400 hover:underline hover:opacity-80"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Delete"
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
