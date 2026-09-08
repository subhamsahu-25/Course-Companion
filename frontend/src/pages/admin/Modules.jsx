// frontend/src/pages/admin/Modules.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getCourseById,
  getModulesByCourse,
  createModule,
  deleteModule,
  getDocumentsByModule,
  getDocumentFileUrl,
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

      // Fetch each module's actual documents (not just a count) so the
      // card can expand to show file names with clickable links.
      const withDocs = await Promise.all(
        modulesRes.data.map(async (mod) => {
          const docsRes = await getDocumentsByModule(mod._id);
          return { ...mod, documents: docsRes.data };
        }),
      );

      setModules(withDocs);
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

  if (!courseId) {
    return (
      <div className="rounded-lg bg-white p-6">
        <p className="text-sm text-[#8AA0AE]">
          No course selected —{' '}
          <button
            onClick={() => onPageChange('admin-courses')}
            className="text-[#457B9D] underline"
          >
            go back to Courses
          </button>
          .
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading modules...</p>;
  }

  return (
    <div>
      <button
        onClick={() => onPageChange('admin-courses')}
        className="text-sm text-[#457B9D] hover:text-[#1D3557]"
      >
        ← Back to courses
      </button>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
            {course?.title}
          </div>

          <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
            Modules
          </h1>

          <p className="mt-2 text-[17px] text-[#647D8D]">
            Manage uploaded material for this course.
          </p>
        </div>

        <button
          onClick={() => setShowNewModule((s) => !s)}
          className="rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F]"
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
          className="mt-6 flex flex-col gap-3 rounded-xl border border-[#D9E1E7] bg-white p-4 sm:flex-row"
        >
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Module title (e.g. Signals & Systems)"
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
        {modules.length === 0 && (
          <p className="text-sm text-[#8AA0AE]">
            No modules yet — create one above.
          </p>
        )}

        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);

          return (
            <div
              key={mod._id}
              className="rounded-xl border border-[#D9E1E7] bg-white p-6 shadow-sm"
            >
              <div
                onClick={() => toggleExpanded(mod._id)}
                className="flex cursor-pointer items-start justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-xs text-[#78909F] transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                  <span className="text-[19px] font-semibold text-[#2B2D42]">
                    {mod.title}
                  </span>
                </div>

                <button
                  onClick={(e) => handleDeleteModule(mod, e)}
                  className="shrink-0 text-xs text-[#B4636A] hover:underline"
                >
                  Delete
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-5">
                <div
                  onClick={() => toggleExpanded(mod._id)}
                  className="cursor-pointer rounded-lg bg-[#E7F1F6] p-4"
                >
                  <div className="text-[27px] font-bold text-[#1D3557]">
                    {mod.documents.length}
                  </div>
                  <div className="mt-1 text-sm text-[#457B9D]">
                    document{mod.documents.length !== 1 ? 's' : ''} — click to{' '}
                    {isExpanded ? 'hide' : 'view'}
                  </div>
                </div>

                <button
                  onClick={() => onPageChange('admin-upload')}
                  className="rounded-lg bg-[#F1F5F8] p-4 text-left transition hover:bg-[#E7F1F6]"
                >
                  <div className="text-[27px] font-bold text-[#1D3557]">+</div>
                  <div className="mt-1 text-sm text-[#457B9D]">
                    upload material
                  </div>
                </button>
              </div>

              {isExpanded && (
                <div className="mt-5 space-y-2 border-t border-[#D9E1E7] pt-4">
                  {mod.documents.length === 0 && (
                    <p className="text-sm text-[#8AA0AE]">
                      No documents uploaded to this module yet.
                    </p>
                  )}

                  {mod.documents.map((doc) => (
                    <a
                      key={doc._id}
                      href={getDocumentFileUrl(doc._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFB] px-4 py-2.5 text-sm text-[#1D3557] shadow-sm transition hover:bg-[#F0F6F9]"
                    >
                      <span className="truncate">{doc.title}</span>
                      <span className="shrink-0 text-xs uppercase text-[#78909F]">
                        {doc.type}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
