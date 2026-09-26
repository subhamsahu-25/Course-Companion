// frontend/src/pages/admin/Modules.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getCourseById,
  getModulesByCourse,
  createModule,
  deleteModule,
  deleteDocument,
  getDocumentFileUrl,
  removeCourseMember,
} from '../../api/client.js';
export default function AdminModules({ courseId, onPageChange }) {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedModules, setExpandedModules] = useState(() => new Set());
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const courseRes = await getCourseById(courseId);
      setCourse(courseRes.data);
      const modulesRes = await getModulesByCourse(courseId);
      // Documents already arrive populated on each module — the card
      // expands to file names with clickable links, zero extra requests.
      setModules(
        (modulesRes.data || []).map((mod) => ({
          ...mod,
          documents: mod.documents || [],
        })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);
  useEffect(() => {
    if (courseId) loadAll();
  }, [courseId, loadAll]);
  function toggleExpanded(moduleId) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }
  async function handleCreateModule(event) {
    event.preventDefault();
    if (!newModuleTitle.trim()) return;
    setSubmitting(true);
    try {
      await createModule(newModuleTitle, courseId);
      setNewModuleTitle('');
      setShowNewModule(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function handleDeleteModule(mod, event) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${mod.title}"? This cannot be undone. Documents inside it will not be deleted automatically.`,
    );
    if (!confirmed) return;
    try {
      await deleteModule(mod._id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }
  async function handleDeleteDocument(doc, event) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${doc.title}"? The file and its indexed RAG content will be removed.`,
    );
    if (!confirmed) return;
    try {
      await deleteDocument(doc._id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }
  if (!courseId) {
    return (
      <div className="rounded-lg bg-[#1b3554] p-6">
        <p className="text-sm text-[#80aad3]">
          No course selected —{' '}
          <button
            onClick={() => onPageChange('admin-courses')}
            className="text-[#80aad3] underline"
          >
            go back to Courses
          </button>
          .
        </p>
      </div>
    );
  }
  if (loading) {
    return <p className="text-sm text-[#80aad3]">Loading modules...</p>;
  }
  return (
    <div>
      <button
        onClick={() => onPageChange('admin-courses')}
        className="text-sm text-[#80aad3] hover:text-[#c0e6fd] hover:opacity-80"
      >
        ← Back to courses
      </button>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
            {course?.title}
          </div>
          <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">Modules</h1>
          <p className="mt-2 text-[17px] text-[#80aad3]">
            Manage uploaded material for this course.
          </p>
        </div>
        <button
          onClick={() => setShowNewModule((s) => !s)}
          className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6]"
        >
          + New module
        </button>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {showNewModule && (
        <form
          onSubmit={handleCreateModule}
          className="mt-6 flex flex-col gap-3 rounded-xl border border-[#3f6593] bg-[#1b3554] p-4 sm:flex-row"
        >
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Module title (e.g. Signals & Systems)"
            className="flex-1 rounded-md border border-[#3f6593] p-2.5 text-sm outline-none focus:border-[#5b86b6]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-4 py-2 text-sm text-[#c0e6fd] disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {modules.length === 0 && (
          <p className="text-sm text-[#80aad3]">
            No modules yet — create one above.
          </p>
        )}
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);
          return (
            <div
              key={mod._id}
              className="rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm"
            >
              <div
                onClick={() => toggleExpanded(mod._id)}
                className="flex cursor-pointer items-start justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-xs text-[#80aad3] transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                  <span className="text-[19px] font-semibold text-[#c0e6fd]">
                    {mod.title}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteModule(mod, e)}
                  className="shrink-0 text-xs text-red-400 hover:underline hover:opacity-80"
                >
                  Delete
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-5">
                <div
                  onClick={() => toggleExpanded(mod._id)}
                  className="cursor-pointer rounded-lg bg-white/5 p-4"
                >
                  <div className="text-[27px] font-bold text-[#c0e6fd]">
                    {mod.documents.length}
                  </div>
                  <div className="mt-1 text-sm text-[#80aad3]">
                    document{mod.documents.length !== 1 ? 's' : ''} — click to{' '}
                    {isExpanded ? 'hide' : 'view'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onPageChange('admin-upload', { moduleId: mod._id })
                  }
                  className="rounded-lg bg-white/5 p-4 text-left transition-all duration-200 ease-out hover:bg-white/10"
                >
                  <div className="text-[27px] font-bold text-[#c0e6fd]">+</div>
                  <div className="mt-1 text-sm text-[#80aad3]">
                    upload material
                  </div>
                </button>
              </div>
              {isExpanded && (
                <div className="mt-5 space-y-2 border-t border-[#3f6593] pt-4">
                  {mod.documents.length === 0 && (
                    <p className="text-sm text-[#80aad3]">
                      No documents uploaded to this module yet.
                    </p>
                  )}
                  {mod.documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-2.5 text-sm text-[#c0e6fd] shadow-sm transition-all duration-200 ease-out hover:bg-white/10"
                    >
                      <a
                        href={getDocumentFileUrl(doc._id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 break-all hover:underline hover:opacity-80"
                      >
                        {doc.title}
                      </a>
                      <span className="shrink-0 text-xs uppercase text-[#80aad3]">
                        {doc.type}
                      </span>
                      <button
                        onClick={(e) => handleDeleteDocument(doc, e)}
                        className="shrink-0 text-xs text-red-400 hover:underline hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RosterSection
        title="Enrolled students"
        members={course?.students || []}
        courseId={course?._id}
        onChanged={loadAll}
        setError={setError}
      />
      <RosterSection
        title="Teaching assistants"
        members={course?.tas || []}
        courseId={course?._id}
        onChanged={loadAll}
        setError={setError}
      />
    </div>
  );
}
// One roster table (name + roll no.) reused for the students and TAs
// sections. Pre-rollNo accounts show "—" instead of a blank cell.
// Removing pulls the member out of the course (instantly revoking access,
// which is membership-based everywhere) and purges their Q&A history in
// this course's modules.
function RosterSection({ title, members, courseId, onChanged, setError }) {
  async function handleRemove(member) {
    const confirmed = window.confirm(
      `Remove "${member.fullName || member.username}" from this course? They will lose access immediately, and their Q&A history in this course will be deleted.`,
    );
    if (!confirmed) return;
    try {
      await removeCourseMember(courseId, member._id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="mt-8 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm">
      <div className="text-[16px] font-semibold text-[#c0e6fd]">
        {title} ({members.length})
      </div>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-[#80aad3]">
          Nobody here yet — members appear once they join with the course code.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#3f6593] text-xs uppercase text-[#80aad3]">
                <th className="w-1/2 py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Roll no.</th>
                <th className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m._id}
                  className="border-b border-white/10 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-[#c0e6fd]">
                    {m.fullName || m.username}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[#80aad3]">
                    {m.rollNo || '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handleRemove(m)}
                      className="text-xs text-red-400 hover:underline hover:opacity-80"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


