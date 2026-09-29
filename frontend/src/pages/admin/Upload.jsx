// frontend/src/pages/admin/Upload.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCourses,
  getMyModules,
  getDocumentsByModule,
  uploadDocumentWithProgress,
  deleteDocument,
  getDocumentFileUrl,
} from '../../api/client.js';
import { ConfirmDialog, FileIcon, LoadingDots, LoadingState } from '../../components/ui/primitives.jsx';
import { Select } from '../../components/ui/select.jsx';
import {
  getStoredUid,
  cacheGet,
  cacheSet,
  cacheInvalidate,
} from '../../utils/cache.js';

// Rough indexing estimate so the instructor sees a remaining-time hint
// while the RAG service extracts, chunks, embeds, and captions. The bill
// behind one file: text extraction + N embedding calls + overview LLM
// call + up to 8 figure captions — so this scales steeply with size and
// the display below stops counting down past it (never "~0s left" lies).
function estimateIndexSeconds(file) {
  const mb = file.size / 1024 / 1024;
  return Math.min(300, Math.max(20, Math.round(20 + mb * 10)));
}
export default function AdminUpload({ initialModuleId, onPageChange } = {}) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  // Live progress for the file currently being sent:
  // { fileName, fileIndex, fileCount, phase, percent, elapsed, estimate }
  // phase is 'uploading' (real bytes, from XHR) or 'processing' (RAG
  // chunking — timed estimate, since the backend holds one request open).
  const [progress, setProgress] = useState(null);
  const progressTimer = useRef(null);
  const progressStart = useRef(0);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);
  const loadModules = useCallback(
    async ({ ignore } = {}) => {
      const uid = getStoredUid();
      const cachedCourses = cacheGet(uid, 'courses');
      const cachedFlat = cacheGet(uid, 'modules-flat');
      const applyModules = (coursesData, flat) => {
        setCourses(coursesData);
        setModules(flat);
        // Preselect only on an explicit entry (module's "+ upload
        // material"). Independent visits start blank — the instructor
        // picks course + module deliberately.
        if (!initialModuleId) return;
        const initial = flat.find((m) => m._id === initialModuleId);
        if (!initial) return;
        setSelectedCourse(initial.courseId);
        setSelectedModule(initial._id);
      };
      if (cachedCourses && cachedFlat) {
        if (ignore?.()) return;
        applyModules(cachedCourses, cachedFlat);
      }
      try {
        const [coursesRes, modulesRes] = await Promise.all([
          getCourses(),
          getMyModules(),
        ]);
        // Tag every module with its course — the course dropdown needs
        // the mapping to reset the module when the course changes.
        const flat = (modulesRes.data || []).map((m) => ({
          ...m,
          courseId: m.course?._id || m.course,
        }));
        if (ignore?.()) return;
        applyModules(coursesRes.data, flat);
        cacheSet(uid, 'courses', coursesRes.data);
        cacheSet(uid, 'modules-flat', flat);
      } catch (err) {
        if (ignore?.()) return;
        setError(err.message);
      }
    },
    [initialModuleId],
  );
  const loadDocuments = useCallback(
    async ({ ignore } = {}) => {
      if (!selectedModule) {
        setDocuments([]);
        return;
      }
      const uid = getStoredUid();
      const cached = cacheGet(uid, `documents:${selectedModule}`);
      if (cached) setDocuments(cached);
      else setLoadingDocs(true);
      try {
        const res = await getDocumentsByModule(selectedModule);
        if (ignore?.()) return;
        setDocuments(res.data);
        cacheSet(uid, `documents:${selectedModule}`, res.data);
      } catch (err) {
        if (ignore?.()) return;
        if (!cached) setError(err.message);
      } finally {
        if (!ignore?.()) setLoadingDocs(false);
      }
    },
    [selectedModule],
  );
  useEffect(() => {
    let cancelled = false;
    loadModules({ ignore: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadModules]);
  useEffect(() => {
    let cancelled = false;
    loadDocuments({ ignore: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);
  function handleCourseChange(courseId) {
    setSelectedCourse(courseId);
    // Reset the module to the first one in the newly picked course —
    // keeping the old module would silently upload into another course.
    const inCourse = modules.filter((m) => m.courseId === courseId);
    setSelectedModule(inCourse[0]?._id || '');
  }
  function addFiles(fileList) {
    setError('');
    setUploaded(false);
    const selectedFiles = Array.from(fileList);
    for (const file of selectedFiles) {
      const validType =
        file.type === 'application/pdf' || file.type === 'text/plain';
      if (!validType) {
        setError(`${file.name} is not a PDF or text file.`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} is bigger than 20MB.`);
        return;
      }
    }
    setFiles((oldFiles) => [...oldFiles, ...selectedFiles]);
  }
  function removeFile(index) {
    setFiles((oldFiles) =>
      oldFiles.filter((_, fileIndex) => fileIndex !== index),
    );
  }
  async function handleUpload() {
    if (files.length === 0 || !selectedModule) return;
    setUploading(true);
    setError('');
    try {
      // backend accepts one file per request (upload.single("file")) —
      // send each selected file as its own request, with live progress
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const estimate = estimateIndexSeconds(file);
        progressStart.current = Date.now();
        setProgress({
          fileName: file.name,
          fileIndex: i + 1,
          fileCount: files.length,
          phase: 'uploading',
          percent: 0,
          elapsed: 0,
          estimate,
        });
        // Elapsed clock — drives the remaining-time hint during processing.
        if (progressTimer.current) clearInterval(progressTimer.current);
        progressTimer.current = setInterval(() => {
          const elapsed = Math.floor(
            (Date.now() - progressStart.current) / 1000,
          );
          setProgress((p) => (p ? { ...p, elapsed } : p));
        }, 500);
        await uploadDocumentWithProgress(
          selectedModule,
          file,
          file.name,
          ({ loaded, total }) => {
            const percent = total
              ? Math.min(100, Math.round((loaded / total) * 100))
              : 0;
            // Bytes all sent but no response yet = backend is chunking.
            const phase = loaded >= total ? 'processing' : 'uploading';
            setProgress((p) => (p ? { ...p, phase, percent } : p));
          },
        );
        if (progressTimer.current) clearInterval(progressTimer.current);
        setProgress((p) => (p ? { ...p, phase: 'done', percent: 100 } : p));
      }
      setUploaded(true);
      setFiles([]);
      setProgress(null);
      await loadDocuments();
    } catch (err) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      setProgress(null);
      setError(err.message);
    } finally {
      setUploading(false);
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
  function handleDeleteDocument(doc) {
    setConfirm({
      title: `Delete ${doc.title} ?`,
      message: 'This cannot be reverted back.',
      run: async () => {
        const previous = documents;
        setDocuments((old) => old.filter((d) => d._id !== doc._id));
        try {
          await deleteDocument(doc._id);
          cacheInvalidate(getStoredUid(), `documents:${selectedModule}`);
        } catch (err) {
          setDocuments(previous);
          setError(err.message);
        }
      },
    });
  }

  // Bar position: upload bytes fill 0→70%, RAG processing eases 70→95%
  // against the estimate (100% only lands when the request resolves).
  const displayPercent = !progress
    ? 0
    : progress.phase === 'uploading'
      ? Math.min(70, Math.round(progress.percent * 0.7))
      : Math.min(
          95,
          Math.round(
            70 + (progress.elapsed / Math.max(1, progress.estimate)) * 25,
          ),
        );
  // Countdown while under estimate; past it, admit the overrun with the
  // live elapsed clock instead of a "~0s left" lie.
  const overEstimate =
    !!progress && progress.elapsed > progress.estimate;
  const remainingSecs = progress
    ? Math.max(0, progress.estimate - progress.elapsed)
    : 0;
  return (
    <div>
      {onPageChange && initialModuleId && (
        <button
          onClick={() =>
            onPageChange('admin-modules', { courseId: selectedCourse })
          }
          className="mb-4 rounded-md border border-border px-3 py-1.5 text-sm text-body transition-all duration-200 ease-out hover:bg-white/10 hover:text-heading hover:opacity-80 active:scale-[0.99]"
        >
          ← Back to modules
        </button>
      )}
      <div>
        <h1 className="mt-1 font-sans text-[36px] text-heading">
          Upload material
        </h1>
        <p className="mt-2 text-[17px] text-body">
          Add course documents to a module.
        </p>
      </div>
      <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <label
          htmlFor="course"
          className="block text-sm font-medium text-heading"
        >
          Course
        </label>
        {courses.length === 0 ? (
          <p className="mt-2 text-sm text-body">
            No courses exist yet — create one on the Courses page first.
          </p>
        ) : (
          <div className="mt-2">
            <Select
              value={selectedCourse}
              onChange={(id) => handleCourseChange(id)}
              ariaLabel="Course"
              options={courses.map((course) => ({
                id: course._id,
                label: course.title,
              }))}
            />
          </div>
        )}
        <label
          htmlFor="module"
          className="mt-5 block text-sm font-medium text-heading"
        >
          Module
        </label>
        {modules.filter((m) => m.courseId === selectedCourse).length === 0 ? (
          <p className="mt-2 text-sm text-body">
            No modules in this course yet — create one on the Courses page
            first.
          </p>
        ) : (
          <div className="mt-2">
            <Select
              value={selectedModule}
              onChange={(id) => setSelectedModule(id)}
              ariaLabel="Module"
              options={modules
                .filter((m) => m.courseId === selectedCourse)
                .map((mod) => ({ id: mod._id, label: mod.title }))}
            />
          </div>
        )}
        <label
          htmlFor="files"
          className="mt-6 block cursor-pointer rounded-xl border-2 border-dashed border-border bg-white/5 p-10 text-center transition-all duration-200 ease-out hover:border-accent-hover hover:bg-white/5"
        >
          <div className="text-3xl text-body">↑</div>
          <div className="mt-2 text-[17px] font-medium text-heading">
            Choose files to upload
          </div>
          <div className="mt-1 text-sm text-body">
            PDF or TXT, maximum 20MB each
          </div>
          <input
            id="files"
            type="file"
            multiple
            accept=".pdf,.txt"
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {files.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-heading">
              Selected files
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white/5 p-3"
                >
                  <div className="min-w-0">
                    <div className="break-all text-sm text-heading">
                      {file.name}
                    </div>
                    <div className="mt-1 text-xs text-body">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-sm text-body hover:text-heading hover:opacity-80"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading || !selectedModule}
            className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots /> Uploading
              </span>
            ) : (
              'Add to module'
            )}
          </button>
        </div>
        {progress && (
          <div className="mt-4 rounded-xl border border-border bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1 truncate text-heading">
                {progress.fileCount > 1
                  ? `File ${progress.fileIndex} of ${progress.fileCount}: `
                  : ''}
                {progress.fileName}
              </div>
              <div className="shrink-0 text-body">{displayPercent}%</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-body transition-all duration-300"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-body">
              {progress.phase === 'uploading'
                ? 'Uploading file…'
                : overEstimate
                  ? `Still working on it… (${progress.elapsed}s elapsed — larger files take longer)`
                  : `RAG is chunking this file for search… ~${remainingSecs}s left (${progress.elapsed}s elapsed)`}
            </div>
          </div>
        )}
        {uploaded && (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-heading">
            Files added successfully.
          </div>
        )}
      </div>
      {selectedModule && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="text-[16px] font-semibold text-heading">
            Documents in this module
          </div>
          {loadingDocs && (
            <LoadingState message="Getting the documents ready" compact />
          )}
          {!loadingDocs && documents.length === 0 && (
            <p className="mt-3 text-sm text-body">
              No documents uploaded to this module yet.
            </p>
          )}
          {!loadingDocs && documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white/5 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon title={doc.type} />
                    <a
                      href={getDocumentFileUrl(doc._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 break-all text-sm font-medium text-heading hover:underline hover:opacity-80"
                    >
                      {doc.title}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    className="shrink-0 text-xs text-red-400/70 hover:text-red-400 hover:underline hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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


