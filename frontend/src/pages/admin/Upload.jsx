// frontend/src/pages/admin/Upload.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  getCourses,
  getModulesByCourse,
  getDocumentsByModule,
  uploadDocument,
  deleteDocument,
  getDocumentFileUrl,
} from '../../api/client.js';

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
        setSelectedModule(
          initial ? initial._id : inCourse[0]?._id || '',
        );
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
      // send each selected file as its own request
      for (const file of files) {
        await uploadDocument(selectedModule, file, file.name);
      }
      setUploaded(true);
      setFiles([]);
      await loadDocuments();
    } catch (err) {
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

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#854F6C]">
          Administration
        </div>

        <h1 className="mt-1 font-sans text-[36px] text-[#2B124C]">
          Upload material
        </h1>

        <p className="mt-2 text-[17px] text-[#854F6C]">
          Add course documents to a module.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[#DFB6B2] bg-white p-6 shadow-sm">
        <label
          htmlFor="course"
          className="block text-sm font-medium text-[#190019]"
        >
          Course
        </label>

        {courses.length === 0 ? (
          <p className="mt-2 text-sm text-[#854F6C]">
            No courses exist yet — create one on the Courses page first.
          </p>
        ) : (
          <select
            id="course"
            value={selectedCourse}
            onChange={(event) => handleCourseChange(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#DFB6B2] bg-white p-3 text-sm text-[#190019] outline-none focus:border-[#854F6C]"
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
          className="mt-5 block text-sm font-medium text-[#190019]"
        >
          Module
        </label>

        {modules.filter((m) => m.courseId === selectedCourse).length ===
        0 ? (
          <p className="mt-2 text-sm text-[#854F6C]">
            No modules in this course yet — create one on the Courses page
            first.
          </p>
        ) : (
          <select
            id="module"
            value={selectedModule}
            onChange={(event) => setSelectedModule(event.target.value)}
            className="mt-2 w-full rounded-md border border-[#DFB6B2] bg-white p-3 text-sm text-[#190019] outline-none focus:border-[#854F6C]"
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
          className="mt-6 block cursor-pointer rounded-xl border-2 border-dashed border-[#B9CAD5] bg-[#F8FAFB] p-10 text-center transition hover:border-[#854F6C] hover:bg-[#F3F8FA]"
        >
          <div className="text-3xl text-[#854F6C]">↑</div>

          <div className="mt-2 text-[17px] font-medium text-[#190019]">
            Choose files to upload
          </div>

          <div className="mt-1 text-sm text-[#78909F]">
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
          <div className="mt-4 rounded-lg border border-[#F1CACA] bg-[#FFF2F2] p-3 text-sm text-[#A33A3A]">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-[#190019]">
              Selected files
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#DFB6B2] bg-[#F8FAFB] p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[#190019]">
                      {file.name}
                    </div>

                    <div className="mt-1 text-xs text-[#78909F]">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>

                  <button
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-sm text-[#854F6C] hover:text-[#2B124C]"
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
          className="mt-6 rounded-md bg-[#2B124C] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#522B5B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? 'Uploading...' : 'Add to module'}
        </button>

        {uploaded && (
          <div className="mt-4 rounded-lg border border-[#B8D5E4] bg-[#EAF4F8] p-3 text-sm text-[#2B124C]">
            Files added successfully.
          </div>
        )}
      </div>

      {selectedModule && (
        <div className="mt-8 rounded-xl border border-[#DFB6B2] bg-white p-6 shadow-sm">
          <div className="text-[16px] font-semibold text-[#2B124C]">
            Documents in this module
          </div>

          {loadingDocs && (
            <p className="mt-3 text-sm text-[#854F6C]">Loading...</p>
          )}

          {!loadingDocs && documents.length === 0 && (
            <p className="mt-3 text-sm text-[#854F6C]">
              No documents uploaded to this module yet.
            </p>
          )}

          {!loadingDocs && documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#DFB6B2] bg-[#F8FAFB] p-3"
                >
                  <div className="min-w-0">
                    <a
                      href={getDocumentFileUrl(doc._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium text-[#2B124C] hover:underline"
                    >
                      {doc.title}
                    </a>
                    <div className="mt-1 text-xs text-[#78909F] uppercase">
                      {doc.type}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    className="shrink-0 text-xs text-[#B4636A] hover:underline"
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
