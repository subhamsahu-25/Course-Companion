// frontend/src/pages/student/Modules.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getCourseById,
  getModulesByCourse,
  getDocumentFileUrl,
} from '../../api/client.js';
import { FileIcon, LoadingState } from '../../components/ui/primitives.jsx';

export default function StudentModules({ courseId, onPageChange }) {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedModules, setExpandedModules] = useState(() => new Set());
  // Per-PDF orientation blurbs, collapsed by default — one toggle per
  // document, so a module with several PDFs stays scannable.
  const [expandedBlurbs, setExpandedBlurbs] = useState(() => new Set());
  function toggleBlurb(docId) {
    setExpandedBlurbs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const courseRes = await getCourseById(courseId);
      setCourse(courseRes.data);

      const modulesRes = await getModulesByCourse(courseId);

      // getModulesByCourse already populates each module's documents, so
      // file names + open links render with zero extra requests.
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

  if (!courseId) {
    return (
      <div className="rounded-lg bg-surface p-6">
        <p className="text-sm text-body">
          No course selected —{' '}
          <button
            onClick={() => onPageChange('student-courses')}
            className="text-body underline"
          >
            go back to Courses
          </button>
          .
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingState message="Getting the modules ready for you" />;
  }

  return (
    <div>
      <button
        onClick={() => onPageChange('student-courses')}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-body transition-all duration-200 ease-out hover:bg-white/10 hover:text-heading hover:opacity-80 active:scale-[0.99]"
      >
        ← Back to courses
      </button>

      <div className="mt-4">
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-body">
          {course?.title}
        </div>

        <h1 className="mt-1 font-sans text-[36px] text-heading">Modules</h1>

        <p className="mt-2 text-[17px] text-body">
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
          <p className="text-sm text-body">
            No modules in this course yet.
          </p>
        )}

        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);

          return (
            <div
              key={mod._id}
              className="rounded-xl border border-border bg-white/5 p-5"
            >
              <div
                onClick={() => toggleExpanded(mod._id)}
                className="flex cursor-pointer flex-col gap-4 sm:flex-row sm:items-center"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-xl text-accent-ink shadow-sm">
                  📄
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-xs text-body transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    >
                      ▶
                    </span>
                    <span className="text-[19px] font-semibold text-heading">
                      {mod.title}
                    </span>
                  </div>

                  {mod.description && (
                    <div className="mt-1 text-[15px] text-body">
                      {mod.description}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-body">
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
                  className="shrink-0 rounded-md border border-border bg-accent px-5 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                >
                  Ask
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {mod.documents.length === 0 && (
                    <p className="text-sm text-body">
                      No documents uploaded to this module yet.
                    </p>
                  )}

                  {mod.documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="rounded-lg bg-surface px-4 py-2.5 text-sm text-heading shadow-sm transition-all duration-200 ease-out hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <FileIcon title={doc.type} />
                        <a
                          href={getDocumentFileUrl(doc._id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 break-all hover:underline hover:opacity-80"
                        >
                          {doc.title}
                        </a>
                      </div>
                      {doc.overview && (
                        <div className="mt-1.5 pl-6">
                          <button
                            type="button"
                            onClick={() => toggleBlurb(doc._id)}
                            aria-expanded={expandedBlurbs.has(doc._id)}
                            className="text-xs font-medium text-body hover:underline hover:opacity-80"
                          >
                            About this PDF{' '}
                            {expandedBlurbs.has(doc._id) ? '▾' : '▸'}
                          </button>
                          {expandedBlurbs.has(doc._id) && (
                            <p className="mt-1 text-[13px] leading-5 text-white">
                              {doc.overview}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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


