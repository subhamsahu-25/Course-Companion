import { useState } from 'react';
import { openDocumentFile } from '../api/courses';

export default function DocumentList({ documents, onError }) {
  const [openingId, setOpeningId] = useState(null);

  if (!documents?.length) {
    return (
      <p className="text-sm text-[#8AA0AE]">No documents uploaded yet.</p>
    );
  }

  async function openDoc(id) {
    setOpeningId(id);
    try {
      await openDocumentFile(id);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc._id}
          className="flex items-center justify-between gap-3 rounded-lg border border-[#D9E1E7] bg-white px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#2B2D42]">
              {doc.title}
            </div>
            <div className="text-xs uppercase tracking-wide text-[#7390A1]">
              {doc.type || 'file'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => openDoc(doc._id)}
            disabled={openingId === doc._id}
            className="shrink-0 rounded-md border border-[#AFC4D1] bg-white px-3 py-1.5 text-sm text-[#1D3557] hover:bg-[#F6FAFC] disabled:opacity-60"
          >
            {openingId === doc._id ? 'Opening...' : 'View'}
          </button>
        </li>
      ))}
    </ul>
  );
}
