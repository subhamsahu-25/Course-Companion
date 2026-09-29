// Shared UI primitives — one place for buttons, inputs, cards, badges.
// New pages should use these instead of hand-rolling Tailwind classes so
// the next re-skin is a one-file change. Dark theme: ink majors, cream text.
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary:
      'border border-border bg-accent text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60',
    secondary:
      'border border-border bg-accent text-accent-ink hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60',
    ghost: 'text-body hover:bg-white/10 hover:text-heading',
  };
  return (
    <button
      className={cn(
        'rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-out disabled:cursor-not-allowed',
        styles[variant] || styles.primary,
        className,
      )}
      {...props}
    />
  );
}
// Important toggle — gray when unmarked, violet when marked, with the
// live TA-mark count. Shared by the review queue (pending) and TA history
// (resolved) so marking works before AND after approval.
export function ImportantButton({ marked, count = 0, disabled, onToggle }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={marked}
        title={
          marked
            ? 'Marked important — click to unmark'
            : 'Mark as important for the instructor'
        }
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ease-out active:scale-95 disabled:opacity-60 ${
          marked
            ? 'border-accent bg-accent text-accent-ink hover:bg-accent-hover'
            : 'border-border bg-transparent text-body hover:text-heading'
        }`}
      >
        {marked ? '★ Important' : '☆ Important'}
      </button>
      {count > 0 && (
        <span
          title={`${count} TA important mark${count === 1 ? '' : 's'} — 2 highlights it to the instructor`}
          className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
        >
          ★ {count}
        </span>
      )}
    </span>
  );
}
// Three-dot wave loader — same travelling dots as the chat typing
// indicator (see .typing-dot in index.css). bg-current so the dots
// inherit whatever text color surrounds them.
export function LoadingDots({ className }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      aria-hidden="true"
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          style={{ animationDelay: `${dot * 180}ms` }}
          className="typing-dot size-2 rounded-full bg-current"
        />
      ))}
    </span>
  );
}
// Friendly loading block: wave dots on their own row above a bold white
// message, centered. Full version sits in the same wrap-box card as the
// logout dialog, pinned to the viewport middle; `compact` drops the card
// and the pinning for inline spots inside cards.
export function LoadingState({ message, className, compact = false }) {
  const body = (
    <>
      <LoadingDots />
      <p className="text-base font-bold text-white">{message}</p>
    </>
  );
  if (compact) {
    return (
      <div className={cn('flex w-full flex-col items-center gap-3 py-4 text-center', className)}>
        {body}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg p-4">
      <div
        className={cn(
          'flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center shadow-xl',
          className,
        )}
      >
        {body}
      </div>
    </div>
  );
}
// Danger confirm dialog — replaces window.confirm everywhere so deletes
// speak the app's font, colors, and motion. Backdrop click and Cancel
// dismiss; the confirm button runs `onConfirm` (destructive, red).
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-center font-sans text-lg font-semibold break-words text-heading">
          {title}
        </h2>
        {message && (
          <p className="mt-2 text-center text-sm leading-6 text-body">{message}</p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-body hover:bg-white/10 hover:text-heading hover:opacity-80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-500/70 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 ease-out hover:bg-red-500 active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'mt-1 w-full rounded-lg border border-border bg-bg p-3 text-[15px] text-heading outline-none placeholder:text-body/50 focus:border-accent',
        className,
      )}
      {...props}
    />
  );
}
export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
export function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      {eyebrow && (
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-body">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-1 font-sans text-[36px] font-bold text-heading">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] text-body">{subtitle}</p>
      )}
    </div>
  );
}
export function FileIcon({ className, title = 'File' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 42 42"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('size-4 shrink-0 overflow-visible', className)}
    >
      <title>{title}</title>
      <path
        stroke="#D5D7DA"
        strokeWidth="1.5"
        d="M4.75 4A3.25 3.25 0 0 1 8 .75h16c.121 0 .238.048.323.134l10.793 10.793a.46.46 0 0 1 .134.323v24A3.25 3.25 0 0 1 32 39.25H8A3.25 3.25 0 0 1 4.75 36z"
      />
      <path stroke="#D5D7DA" strokeWidth="1.5" d="M24 .5V8a4 4 0 0 0 4 4h7.5" />
      <path
        stroke="#155EEF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M11.9 19.5h16.2m-16.2 3.6h16.2m-16.2 3.6h16.2m-16.2 3.6h12.6"
      />
    </svg>
  );
}

export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'border-red-400/40 bg-red-950/50 text-red-200',
    success: 'border-green-400/40 bg-green-950/50 text-green-200',
    info: 'border-border bg-surface text-body',
  };
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm',
        styles[tone] || styles.error,
      )}
    >
      {children}
    </div>
  );
}

