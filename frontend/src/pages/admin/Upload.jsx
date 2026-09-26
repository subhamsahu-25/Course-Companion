// frontend/src/pages/admin/Upload.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCourses,
  getModulesByCourse,
  getDocumentsByModule,
  uploadDocumentWithProgress,
  deleteDocument,
  getDocumentFileUrl,
} from '../../api/client.js';

// Rough indexing estimate so the instructor sees a remaining-time hint
// while the RAG service chunks + embeds. Real time varies with RAG load,
// so this is a floor estimate that counts up, never a fake promise.
function estimateIndexSeconds(file) {
  const mb = file.size / 1024 / 1024;
  return Math.min(180, Math.max(10, Math.round(8 + mb * 5)));
}
export default function AdminUpload({ initialModuleId } = {}) {
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
      try {
        const coursesRes = await getCourses();
        const modulesPerCourse = await Promise.all(
          coursesRes.data.map((c) => getModulesByCourse(c._id)),
        );
        // Tag every module with its course — the module payload doesn't
        // reliably carry it, and the course dropdown needs the mapping.
        const flat = modulesPerCourse.flatMap((res, i) =>
          res.data.map((m) => ({ ...m, courseId: coursesRes.data[i]._id })),
        );
        if (ignore?.()) return;
        setCourses(coursesRes.data);
        setModules(flat);
        // Prefer the module the admin actually clicked "+ upload material"
        // on (plus its course) — otherwise first course + its first module.
        const initial = flat.find((m) => m._id === initialModuleId);
        const courseId = initial
          ? initial.courseId
          : coursesRes.data[0]?._id || '';
        setSelectedCourse(courseId);
        const inCourse = flat.filter((m) => m.courseId === courseId);
        setSelectedModule(initial ? initial._id : inCourse[0]?._id || '');
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
      setLoadingDocs(true);
      try {
        const res = await getDocumentsByModule(selectedModule);
        if (ignore?.()) return;
        setDocuments(res.data);
      } catch (err) {
        if (ignore?.()) return;
        setError(err.message);
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
  async function handleDeleteDocument(doc) {
    const confirmed = window.confirm(`Delete "${doc.title}"?`);
    if (!confirmed) return;
    try {
      await deleteDocument(doc._id);
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    }
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
  const remainingSecs = progress
    ? Math.max(0, progress.estimate - progress.elapsed)
    : 0;
  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
          Administration
        </div>
        <h1 className="mt-1 font-sans text-[36px] text-[#c0e6fd]">
          Upload material
        </h1>
        <p className="mt-2 text-[17px] text-[#80aad3]">
          Add course documents to a module.
        </p>
      </div>
      <div className="mt-8 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm">
        <label
          htmlFor="course"
          className="block text-sm font-medium text-[#c0e6fd]"
        >
          Course
        </label>
        {courses.length === 0 ? (
          <p className="mt-2 text-sm text-[#80aad3]">
            No courses exist yet — create one on the Courses page first.
          </p>
        ) : (
          <select
            id="course"
            value={selectedCourse}
            onChange={(event) => handleCourseChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#3f6593] bg-[#000f22] p-3 text-sm text-[#c0e6fd] outline-none focus:border-[#5b86b6]"
          >
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
        )}
        <label
          htmlFor="module"
          className="mt-5 block text-sm font-medium text-[#c0e6fd]"
        >
          Module
        </label>
        {modules.filter((m) => m.courseId === selectedCourse).length === 0 ? (
          <p className="mt-2 text-sm text-[#80aad3]">
            No modules in this course yet — create one on the Courses page
            first.
          </p>
        ) : (
          <select
            id="module"
            value={selectedModule}
            onChange={(event) => setSelectedModule(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#3f6593] bg-[#000f22] p-3 text-sm text-[#c0e6fd] outline-none focus:border-[#5b86b6]"
          >
            {modules
              .filter((m) => m.courseId === selectedCourse)
              .map((mod) => (
                <option key={mod._id} value={mod._id}>
                  {mod.title}
                </option>
              ))}
          </select>
        )}
        <label
          htmlFor="files"
          className="mt-6 block cursor-pointer rounded-xl border-2 border-dashed border-[#5b86b6] bg-white/5 p-10 text-center transition-all duration-200 ease-out hover:border-[#5b86b6] hover:bg-white/5"
        >
          <div className="text-3xl text-[#80aad3]">↑</div>
          <div className="mt-2 text-[17px] font-medium text-[#c0e6fd]">
            Choose files to upload
          </div>
          <div className="mt-1 text-sm text-[#80aad3]">
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
            <div className="mb-2 text-sm font-medium text-[#c0e6fd]">
              Selected files
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#3f6593] bg-white/5 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[#c0e6fd]">
                      {file.name}
                    </div>
                    <div className="mt-1 text-xs text-[#80aad3]">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-sm text-[#80aad3] hover:text-[#c0e6fd] hover:opacity-80"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!files.length || uploading || !selectedModule}
          className="mt-6 rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? 'Uploading...' : 'Add to module'}
        </button>
        {progress && (
          <div className="mt-4 rounded-xl border border-[#3f6593] bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 truncate text-[#c0e6fd]">
                {progress.fileCount > 1
                  ? `File ${progress.fileIndex} of ${progress.fileCount}: `
                  : ''}
                {progress.fileName}
              </div>
              <div className="shrink-0 text-[#80aad3]">{displayPercent}%</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#000f22]">
              <div
                className="h-full rounded-full bg-[#80aad3] transition-all duration-300"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-[#80aad3]">
              {progress.phase === 'uploading'
                ? 'Uploading file…'
                : `RAG is chunking this file for search… ~${remainingSecs}s left (${progress.elapsed}s elapsed)`}
            </div>
          </div>
        )}
        {uploaded && (
          <div className="mt-4 rounded-lg border border-[#3f6593] bg-[#1b3554] p-3 text-sm text-[#c0e6fd]">
            Files added successfully.
          </div>
        )}
      </div>
      {selectedModule && (
        <div className="mt-8 rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm">
          <div className="text-[16px] font-semibold text-[#c0e6fd]">
            Documents in this module
          </div>
          {loadingDocs && (
            <p className="mt-3 text-sm text-[#80aad3]">Loading...</p>
          )}
          {!loadingDocs && documents.length === 0 && (
            <p className="mt-3 text-sm text-[#80aad3]">
              No documents uploaded to this module yet.
            </p>
          )}
          {!loadingDocs && documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#3f6593] bg-white/5 p-3"
                >
                  <div className="min-w-0">
                    <a
                      href={getDocumentFileUrl(doc._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium text-[#c0e6fd] hover:underline hover:opacity-80"
                    >
                      {doc.title}
                    </a>
                    <div className="mt-1 text-xs text-[#80aad3] uppercase">
                      {doc.type}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    className="shrink-0 text-xs text-red-400 hover:underline hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


