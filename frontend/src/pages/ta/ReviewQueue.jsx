import { useState } from 'react'

const startingItems = [
  {
    id: 1,
    module: 'Signals & Systems',
    question:
      'Why does the ROC of a Laplace transform matter for stability?',
    answer:
      'Stability requires the ROC to include the imaginary axis. If the system is causal, all poles must lie in the left half-plane.',
    status: 'draft',
  },
  {
    id: 2,
    module: 'Electromagnetics',
    question:
      'What does a negative divergence of E indicate physically?',
    answer:
      'A negative divergence means the point acts as a sink. Field lines converge into it, which corresponds to negative charge density.',
    status: 'draft',
  },
]

export default function ReviewQueue() {
  const [items, setItems] = useState(startingItems)
  const [editingId, setEditingId] = useState(null)
  const [answerText, setAnswerText] = useState('')

  function changeStatus(id, status) {
    setItems((oldItems) =>
      oldItems.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
            }
          : item
      )
    )
  }

  function startEditing(item) {
    setEditingId(item.id)
    setAnswerText(item.answer)
  }

  function saveAnswer(id) {
    setItems((oldItems) =>
      oldItems.map((item) =>
        item.id === id
          ? {
              ...item,
              answer: answerText,
              status: 'reviewed',
            }
          : item
      )
    )

    setEditingId(null)
    setAnswerText('')
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

      <div className="mt-8 space-y-5">

        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-xl border border-[#D9E1E7] bg-white shadow-sm"
          >

            <div className="flex items-center justify-between bg-[#E7F1F6] px-5 py-3">

              <span className="text-xs font-semibold uppercase tracking-wide text-[#457B9D]">
                {item.module}
              </span>

              <span className="rounded-full bg-white px-3 py-1 text-xs text-[#457B9D]">
                {item.status}
              </span>

            </div>

            <div className="p-6">

              <div className="text-[18px] font-semibold text-[#2B2D42]">
                {item.question}
              </div>

              {editingId === item.id ? (
                <textarea
                  value={answerText}
                  onChange={(event) =>
                    setAnswerText(event.target.value)
                  }
                  rows="5"
                  className="mt-4 w-full rounded-lg border border-[#C8D6DF] p-3 text-[15px] outline-none focus:border-[#457B9D]"
                />
              ) : (
                <p className="mt-4 text-[15px] leading-6 text-[#354F61]">
                  {item.answer}
                </p>
              )}

              {item.status !== 'published' &&
                item.status !== 'rejected' && (
                  <div className="mt-5 flex flex-wrap gap-2">

                    {editingId === item.id ? (
                      <button
                        onClick={() =>
                          saveAnswer(item.id)
                        }
                        className="rounded-md bg-[#457B9D] px-4 py-2 text-sm text-white hover:bg-[#386B89]"
                      >
                        Save changes
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            changeStatus(
                              item.id,
                              'published'
                            )
                          }
                          className="rounded-md bg-[#1D3557] px-4 py-2 text-sm text-white hover:bg-[#28476F]"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            startEditing(item)
                          }
                          className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA]"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            changeStatus(
                              item.id,
                              'rejected'
                            )
                          }
                          className="rounded-md border border-[#C8D6DF] bg-white px-4 py-2 text-sm text-[#2B2D42] hover:bg-[#F5F8FA]"
                        >
                          Reject
                        </button>
                      </>
                    )}

                  </div>
                )}

            </div>

          </div>
        ))}

      </div>

    </div>
  )
}