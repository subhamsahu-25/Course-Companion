// frontend/src/pages/student/Modules.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getCourseById,
  getModulesByCourse,
  getDocumentsByModule,
  getDocumentFileUrl,
} from '../../api/client.js';

export default function StudentModules({ courseId, onPageChange }) {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedModules, setExpandedModules] = useState(() => new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const courseRes = await getCourseById(courseId);
      setCourse(courseRes.data);

      const modulesRes = await getModulesByCourse(courseId);

      // Fetch each module's actual documents (not just a count) so we can
      // list real file names with open links, grouped module-wise.
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

  if (!courseId) {
    return (
      <div className="rounded-lg bg-white p-6">
        <p className="text-sm text-[#8AA0AE]">
          No course selected —{' '}
          <button
            onClick={() => onPageChange('student-courses')}
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
        onClick={() => onPageChange('student-courses')}
        className="text-sm text-[#457B9D] hover:text-[#1D3557]"
      >
        ← Back to courses
      </button>

      <div className="mt-4">
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          {course?.title}
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">Modules</h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Browse uploaded course material by module.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {modules.length === 0 && !error && (
          <p className="text-sm text-[#8AA0AE]">
            No modules in this course yet.
          </p>
        )}

        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);

          return (
            <div
              key={mod._id}
              className="rounded-xl border border-[#C9D9E3] bg-[#E7F1F6] p-5"
            >
              <div
                onClick={() => toggleExpanded(mod._id)}
                className="flex cursor-pointer flex-col gap-4 sm:flex-row sm:items-center"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-xl text-[#457B9D] shadow-sm">
                  📄
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-xs text-[#7390A1] transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    >
                      ▶
                    </span>
                    <span className="text-[19px] font-semibold text-[#2B2D42]">
                      {mod.title}
                    </span>
                  </div>

                  {mod.description && (
                    <div className="mt-1 text-[15px] text-[#536F81]">
                      {mod.description}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-[#7390A1]">
                    {mod.documents.length} document
                    {mod.documents.length !== 1 ? 's' : ''} — click to{' '}
                    {isExpanded ? 'hide' : 'view'}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPageChange('student-ask', { moduleId: mod._id });
                  }}
                  className="shrink-0 rounded-md border border-[#AFC4D1] bg-white px-5 py-2 text-sm font-medium text-[#1D3557] hover:bg-[#F6FAFC]"
                >
                  Ask
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-2 border-t border-[#C9D9E3] pt-4">
                  {mod.documents.length === 0 && (
                    <p className="text-sm text-[#7390A1]">
                      No documents uploaded to this module yet.
                    </p>
                  )}

                  {mod.documents.map((doc) => (
                    <a
                      key={doc._id}
                      href={getDocumentFileUrl(doc._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-2.5 text-sm text-[#1D3557] shadow-sm transition hover:bg-[#F6FAFC]"
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
