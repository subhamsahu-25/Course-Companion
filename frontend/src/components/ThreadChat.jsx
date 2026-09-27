// frontend/src/components/ThreadChat.jsx — chatbot-style follow-up thread.
// Used only in the Ask page's follow-up mode: the root Q&A plus every
// follow-up renders as chat bubbles (student right, answers left), with
// the composer pinned at the bottom. History arrives from getMyAnswers
// filtered by thread — no new endpoint needed.
import { useEffect, useRef, useState } from 'react';
import {
  askQuestion,
  getMyAnswer,
  getMyAnswers,
} from '../api/client.js';
import { LoadingState } from './ui/primitives.jsx';

function AnswerBubble({ message }) {
  if (message.pending) {
    // Three-dot wave while generating — staggered bounces read as
    // "working", not a frozen screen.
    return (
      <div className="flex justify-start">
        <div
          className="flex flex-col items-start gap-2 rounded-2xl rounded-tl-md border border-border bg-bg px-4 py-3"
          aria-label="Getting your answer ready"
        >
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                style={{ animationDelay: `${dot * 180}ms` }}
                className="typing-dot size-2 rounded-full bg-body"
              />
            ))}
          </div>
          <span className="text-xs font-medium text-body">
            Getting your answer ready
          </span>
        </div>
      </div>
    );
  }
  if (!message.answer) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-bg px-4 py-2.5 text-sm italic text-body">
          Awaiting TA review.
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-bg px-4 py-2.5 text-sm leading-6 text-heading">
        {message.answer}
      </div>
    </div>
  );
}

export default function ThreadChat({ thread }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadThread() {
      setLoading(true);
      try {
        // Threads excluded from History by default — opt back in here,
        // this is their home view.
        const res = await getMyAnswers(true);
        if (cancelled) return;
        const threadItems = (res.data || [])
          .filter((item) => item.threadId === thread.threadId || item.id === thread.threadId)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map((item) => ({
            key: item.id,
            question: item.question,
            answer: item.status === 'pending' ? null : item.answer,
            pending: item.status === 'pending',
          }));
        setMessages(threadItems);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [thread.threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function send(event) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    setInput('');
    const tempKey = `temp-${Date.now()}`;
    setMessages((old) => [...old, { key: tempKey, question: text, answer: null, pending: true }]);
    try {
      const res = await askQuestion(text, thread.moduleId, thread.threadId);
      let answer = res.data?.threadAnswered ? res.data?.answer || null : null;
      if (res.data?.autoServed && !answer) {
        // Instant answers resolve server-side — pull the served text so
        // the bubble fills in like every other answer.
        try {
          const full = await getMyAnswer(res.data?.request_id || res.data?.id);
          answer = full.data?.answer || null;
        } catch {
          answer = null;
        }
      }
      const done = answer !== null;
      setMessages((old) =>
        old.map((m) =>
          m.key === tempKey ? { ...m, answer, pending: !done } : m,
        ),
      );
    } catch (err) {
      setError(err.message);
      setMessages((old) =>
        old.map((m) =>
          m.key === tempKey
            ? { ...m, answer: 'Could not send — tap Send to retry.', pending: false, failed: true }
            : m,
        ),
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="max-h-[50vh] space-y-3 overflow-y-auto p-5">
        {loading && <LoadingState message="Opening the conversation" compact />}
        {!loading &&
          messages.map((message) => (
            <div key={message.key} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm leading-6 text-accent-ink">
                  {message.question}
                </div>
              </div>
              <AnswerBubble message={message} />
            </div>
          ))}
        <div ref={bottomRef} />
      </div>
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-border bg-bg p-3"
      >
        <textarea
          rows="2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) send(event);
          }}
          placeholder="Ask a follow-up… (Enter to send, Shift+Enter for a new line)"
          className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-surface p-3 text-[15px] text-heading outline-none placeholder:text-body focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
