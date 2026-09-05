import { useState } from 'react'

const previousAnswers = [
  {
    question:
      'Why does the ROC of a Laplace transform matter for stability?',
    answer:
      'Stability requires the ROC to include the imaginary axis. If the system is causal, all poles must lie in the left half-plane so the ROC extends to the right of them.',
    source:
      'Signals & Systems — Week 4 notes, p.12',
  },
  {
    question:
      'What is the difference between a Mealy and a Moore machine?',
    answer:
      "A Moore machine's output depends on the current state. A Mealy machine uses the current state and input, so it can react sooner.",
    source:
      'Digital Logic Design — Sequential circuits',
  },
]

export default function StudentAsk() {
  const [question, setQuestion] = useState('')
  const [sent, setSent] = useState(false)

  function submitQuestion(event) {
    event.preventDefault()

    if (!question.trim()) {
      return
    }

    setSent(true)
    setQuestion('')
  }

  return (
    <div>

      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Signals & Systems
        </div>

        <h1 className="mt-1 font-serif text-[34px] text-[#1D3557]">
          Ask a question
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Ask something about the course material.
        </p>
      </div>

      <form
        onSubmit={submitQuestion}
        className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-5 shadow-sm"
      >

        <label
          htmlFor="question"
          className="text-sm font-medium text-[#2B2D42]"
        >
          Your question
        </label>

        <textarea
          id="question"
          rows="5"
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          placeholder="Type your question here..."
          className="mt-2 w-full resize-none rounded-lg border border-[#C8D6DF] bg-[#FBFCFD] p-4 text-[16px] text-[#2B2D42] outline-none placeholder:text-[#8AA0AE] focus:border-[#457B9D]"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <span className="text-sm text-[#647D8D]">
            A TA reviews the answer before it is published.
          </span>

          <button
            type="submit"
            className="rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F]"
          >
            Submit question
          </button>

        </div>

      </form>

      {sent && (
        <div className="mt-4 rounded-lg border border-[#B8D5E4] bg-[#EAF4F8] p-4 text-sm text-[#1D3557]">
          Your question was submitted to the TA review
          queue.
        </div>
      )}

      <div className="mt-10">

        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#457B9D]">
          Previously answered
        </h2>

        <div className="mt-4 space-y-4">

          {previousAnswers.map((item) => (
            <div
              key={item.question}
              className="rounded-xl border border-[#C9D9E3] bg-[#E7F1F6] p-5"
            >

              <div className="text-[18px] font-semibold text-[#2B2D42]">
                {item.question}
              </div>

              <p className="mt-3 text-[15px] leading-6 text-[#354F61]">
                {item.answer}
              </p>

              <p className="mt-4 text-xs text-[#6E8999]">
                Source: {item.source}
              </p>

            </div>
          ))}

        </div>

      </div>

    </div>
  )
}