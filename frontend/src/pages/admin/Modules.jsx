// frontend/src/pages/admin/Modules.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCourseById,
  getModulesByCourse,
  createModule,
  deleteModule,
  deleteDocument,
  getDocumentFileUrl,
  getImportantQuestions,
  getCourseQaStats,
} from '../../api/client.js';
import { ConfirmDialog, FileIcon, LoadingState } from '../../components/ui/primitives.jsx';
import {
  getStoredUid,
  cacheGet,
  cacheSet,
  cacheInvalidate,
} from '../../utils/cache.js';
export default function AdminModules({ courseId, onPageChange }) {
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModule, setShowNewModule] = useState(false);
  // Click-outside dismiss for the create form (the toggle button lives
  // inside the watched block so opening clicks don't instantly close).
  const newModuleRef = useRef(null);
  useEffect(() => {
    if (!showNewModule) return;
    function onPointerDown(event) {
      if (newModuleRef.current && !newModuleRef.current.contains(event.target)) {
        setShowNewModule(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showNewModule]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedModules, setExpandedModules] = useState(() => new Set());
  // TA-highlighted questions (enough important marks) + per-member Q&A
  // activity for this course. Separate calls so a rag outage degrades to
  // empty sections instead of failing the whole page.
  const [importantQuestions, setImportantQuestions] = useState([]);
  const [qaStats, setQaStats] = useState({ asked: [], reviewed: [], gaps: [], quality: null });
  const loadAll = useCallback(async () => {
    const uid = getStoredUid();
    const cachedCourse = cacheGet(uid, `course:${courseId}`);
    const cachedModules = cacheGet(uid, `modules:${courseId}`);
    if (cachedCourse && cachedModules) {
      setCourse(cachedCourse);
      setModules(cachedModules);
    } else {
      setLoading(true);
    }
    try {
      const courseRes = await getCourseById(courseId);
      setCourse(courseRes.data);
      cacheSet(uid, `course:${courseId}`, courseRes.data);
      const modulesRes = await getModulesByCourse(courseId);
      try {
        const [importantRes, statsRes] = await Promise.all([
          getImportantQuestions(courseId),
          getCourseQaStats(courseId),
        ]);
        setImportantQuestions(importantRes.data || []);
        setQaStats(statsRes.data || { asked: [], reviewed: [], gaps: [], quality: null });
      } catch {
        // rag service down — rosters and modules below still render.
        setImportantQuestions([]);
        setQaStats({ asked: [], reviewed: [], gaps: [], quality: null });
      }
      // Documents already arrive populated on each module — the card
      // expands to file names with clickable links, zero extra requests.
      const fresh = (modulesRes.data || []).map((mod) => ({
        ...mod,
        documents: mod.documents || [],
      }));
      setModules(fresh);
      cacheSet(uid, `modules:${courseId}`, fresh);
    } catch (err) {
      if (!cachedCourse || !cachedModules) setError(err.message);
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
  // Pending danger action for the custom confirm dialog (replaces the
  // browser's window.confirm). { title, message, run } | null.
  const [confirm, setConfirm] = useState(null);
  async function runConfirm() {
    const action = confirm?.run;
    setConfirm(null);
    if (action) await action();
  }
  function handleDeleteModule(mod, event) {
    event.stopPropagation();
    setConfirm({
      title: `Delete ${mod.title} ?`,
      message: 'This cannot be reverted back.',
      run: async () => {
        const previous = modules;
        setModules((old) => old.filter((m) => m._id !== mod._id));
        try {
          await deleteModule(mod._id);
          cacheInvalidate(getStoredUid(), `modules:${courseId}`);
        } catch (err) {
          setModules(previous);
          setError(err.message);
        }
      },
    });
  }
  function handleDeleteDocument(doc, event) {
    event.stopPropagation();
    setConfirm({
      title: `Delete ${doc.title} ?`,
      message: 'This cannot be reverted back.',
      run: async () => {
        const previous = modules;
        setModules((old) =>
          old.map((m) => ({
            ...m,
            documents: (m.documents || []).filter((d) => {
              const id = d._id || d;
              return id !== doc._id;
            }),
          })),
        );
        try {
          await deleteDocument(doc._id);
          cacheInvalidate(getStoredUid(), `modules:${courseId}`);
        } catch (err) {
          setModules(previous);
          setError(err.message);
        }
      },
    });
  }
  if (!courseId) {
    return (
      <div className="rounded-lg bg-surface p-6">
        <p className="text-sm text-body">
          No course selected —{' '}
          <button
            onClick={() => onPageChange('admin-courses')}
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
        onClick={() => onPageChange('admin-courses')}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-body transition-all duration-200 ease-out hover:bg-white/10 hover:text-heading hover:opacity-80 active:scale-[0.99]"
      >
        ← Back to courses
      </button>
      <div ref={newModuleRef}>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-body">
            {course?.title}
          </div>
          <h1 className="mt-1 font-sans text-[36px] text-heading">Modules</h1>
          <p className="mt-2 text-[17px] text-body">
            Manage uploaded material for this course.
          </p>
        </div>
        <button
          onClick={() => setShowNewModule((s) => !s)}
          className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
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
          className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row"
        >
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module title (required)"
            className="flex-1 rounded-md border border-border p-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border border-border bg-accent px-4 py-2 text-sm text-accent-ink disabled:opacity-60"
          >
            Create
          </button>
        </form>
      )}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {modules.length === 0 && (
          <p className="text-sm text-body">
            No modules yet — create one above.
          </p>
        )}
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);
          return (
            <div
              key={mod._id}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <div
                onClick={() => toggleExpanded(mod._id)}
                className="flex cursor-pointer items-start justify-between gap-3"
              >
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
                <button
                  onClick={(e) => handleDeleteModule(mod, e)}
                  className="shrink-0 text-xs text-red-400/70 hover:text-red-400 hover:underline hover:opacity-80"
                >
                  Delete
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-5">
                <div
                  onClick={() => toggleExpanded(mod._id)}
                  className="cursor-pointer rounded-lg bg-white/5 p-4"
                >
                  <div className="text-[27px] font-bold text-heading">
                    {mod.documents.length}
                  </div>
                  <div className="mt-1 text-sm text-body">
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
                  <div className="text-[27px] font-bold text-heading">+</div>
                  <div className="mt-1 text-sm text-body">
                    upload material
                  </div>
                </button>
              </div>
              {isExpanded && (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  {mod.documents.length === 0 && (
                    <p className="text-sm text-body">
                      No documents uploaded to this module yet.
                    </p>
                  )}
                  {mod.documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-2.5 text-sm text-heading shadow-sm transition-all duration-200 ease-out hover:bg-white/10"
                    >
                      <a
                        href={getDocumentFileUrl(doc._id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-2 hover:underline hover:opacity-80"
                      >
                        <FileIcon title={doc.type} />
                        <span className="min-w-0 flex-1 break-all">
                          {doc.title}
                        </span>
                      </a>
                      <button
                        onClick={(e) => handleDeleteDocument(doc, e)}
                        className="shrink-0 text-xs text-red-400/70 hover:text-red-400 hover:underline hover:opacity-80"
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
      <ImportantQuestionsSection
        questions={importantQuestions}
        modules={modules}
      />
      <AnswerQualitySection quality={qaStats.quality} />
      <ContentGapsSection gaps={qaStats.gaps || []} modules={modules} />
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
// Questions the TAs collectively flagged as important (enough distinct-TA
// marks to cross the threshold) — questions only, newest highlights first
// by mark count, each labeled with its module.
function ImportantQuestionsSection({ questions, modules }) {
  if (questions.length === 0) return null;
  const moduleById = new Map(modules.map((m) => [m._id, m]));
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="text-[16px] font-semibold text-heading">
        Important questions ({questions.length})
      </div>
      <p className="mt-1 text-xs text-body">
        Flagged by your TAs as worth your attention.
      </p>
      <ul className="mt-3 space-y-3">
        {questions.map((q) => (
          <li
            key={q.id}
            className="rounded-lg bg-black/20 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-heading">
                {q.question}
              </span>
              <span
                title="Distinct-TA important marks"
                className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
              >
                ★ {q.importantCount}
              </span>
            </div>
            {moduleById.get(q.moduleId) && (
              <div className="mt-1 text-xs text-body">
                {moduleById.get(q.moduleId).title}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
// Answer-quality overview for the course: average TA rating, how many
// answers were improved vs approved as-is, outcomes, and mean time from
// question to resolution. Null until the first resolved review exists.
function AnswerQualitySection({ quality }) {
  if (!quality || quality.approvedCount + quality.rejectedCount === 0) return null;
  const cells = [
    {
      label: 'Avg TA rating',
      value: quality.avgRating !== null ? `★ ${quality.avgRating}/5` : '—',
      sub: quality.ratedCount > 0 ? `${quality.ratedCount} rated` : 'nothing rated yet',
    },
    {
      label: 'Improved by TA',
      value: String(quality.editedCount),
      sub: `of ${quality.approvedCount} approved`,
    },
    {
      label: 'Outcomes',
      value: `${quality.approvedCount} ✓ / ${quality.rejectedCount} ✕`,
      sub: `${quality.pendingCount} awaiting review`,
    },
    {
      label: 'Avg resolution',
      value: quality.avgResolutionHours !== null ? `${quality.avgResolutionHours}h` : '—',
      sub: 'asked → resolved',
    },
  ];
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="text-[16px] font-semibold text-heading">
        Answer quality
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-body">
              {cell.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-heading">
              {cell.value}
            </div>
            <div className="text-xs text-body">{cell.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// Curriculum radar: modules where students asked things the material
// couldn't answer ("I don't know." drafts), most-exposed first. Each row
// is a candidate for new material, not a failure.
function ContentGapsSection({ gaps, modules }) {
  if (gaps.length === 0) return null;
  const moduleById = new Map(modules.map((m) => [m._id, m]));
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="text-[16px] font-semibold text-heading">
        Content gaps ({gaps.length})
      </div>
      <p className="mt-1 text-xs text-body">
        Topics students asked about that the material couldn&apos;t answer.
      </p>
      <ul className="mt-3 space-y-2">
        {gaps.map((gap) => (
          <li
            key={gap.moduleId}
            className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-4 py-2.5"
          >
            <span className="text-sm font-medium text-heading">
              {moduleById.get(gap.moduleId)?.title || 'Unknown module'}
            </span>
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {gap.unanswered} unanswered / {gap.asked} asked
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
