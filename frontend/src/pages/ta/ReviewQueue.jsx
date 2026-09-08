import { useEffect, useState } from 'react';
import {
  getReviewQueue,
  approveAnswer,
  rejectAnswer,
} from '../../api/client.js';

export default function ReviewQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewQueue();
      setItems(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEditing(item) {
    setEditingId(item._id);
    setAnswerText(item.draftAnswer);
  }

  function cancelEditing() {
    setEditingId(null);
    setAnswerText('');
  }

  async function approve(id, editedAnswer) {
    setActioningId(id);
    setError(null);
    try {
      await approveAnswer(id, editedAnswer);
      setEditingId(null);
      setAnswerText('');
      // Approved items drop off the pending queue, so just refetch.
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  async function reject(id) {
    const note = window.prompt(
      'Optional note for the student (leave blank to use the default message):',
    );
    if (note === null) return; // they hit cancel

    setActioningId(id);
    setError(null);
    try {
      await rejectAnswer(id, note || undefined);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#647D8D]">Loading review queue...</p>;
  }

  return (
    <div>
      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Teaching Assistant
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
          Review Queue
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Check drafted answers before they are published.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 && !error && (
        <p className="mt-8 text-sm text-[#8AA0AE]">
          Nothing waiting on review right now.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {items.map((item) => (
          <div
            key={item._id}
            className="overflow-hidden rounded-xl border border-[#D9E1E7] bg-white shadow-sm"
          >
            <div className="flex items-center justify-between bg-[#E7F1F6] px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#457B9D]">
                {new Date(item.createdAt).toLocaleString()}
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs text-[#457B9D]">
                {item.status}
              </span>
            </div>

            <div className="p-6">
              <div className="text-[18px] font-semibold text-[#2B2D42]">
                {item.question}
              </div>

              {editingId === item._id ? (
                <textarea
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  rows="5"
                  className="mt-4 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
                />
              ) : (
                <p className="mt-4 text-[15px] leading-6 text-[#354F61]">
                  {item.draftAnswer}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {editingId === item._id ? (
                  <>
                    <button
                      onClick={() => approve(item._id, answerText)}
                      disabled={actioningId === item._id}
                      className="rounded-md bg-[#457B9D] px-4 py-2 text-sm text-white hover:bg-[#386B89] disabled:opacity-60"
                    >
                      {actioningId === item._id ? 'Saving…' : 'Save & approve'}
                    </button>

                    <button
                      onClick={cancelEditing}
                      disabled={actioningId === item._id}
                      className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => approve(item._id)}
                      disabled={actioningId === item._id}
                      className="rounded-md bg-[#1D3557] px-4 py-2 text-sm text-white hover:bg-[#28476F] disabled:opacity-60"
                    >
                      {actioningId === item._id ? 'Approving…' : 'Approve'}
                    </button>

                    <button
                      onClick={() => startEditing(item)}
                      disabled={actioningId === item._id}
                      className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => reject(item._id)}
                      disabled={actioningId === item._id}
                      className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA] disabled:opacity-60"
                    >
                      {actioningId === item._id ? 'Rejecting…' : 'Reject'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
