// Shared UI primitives — one place for buttons, inputs, cards, badges.
// New pages should use these instead of hand-rolling Tailwind classes so
// the next re-skin is a one-file change.
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary:
      'bg-[#2B124C] text-[#FBE4D8] hover:bg-[#522B5B] disabled:opacity-60',
    secondary:
      'border border-[#2B124C] text-[#2B124C] hover:bg-[#DFB6B2]/30 disabled:opacity-60',
    ghost: 'text-[#854F6C] hover:bg-[#DFB6B2]/30 hover:text-[#2B124C]',
  };
  return (
    <button
      className={cn(
        'rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed',
        styles[variant] || styles.primary,
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'mt-1 w-full rounded-lg border border-[#DFB6B2] bg-white p-3 text-[15px] text-[#190019] outline-none placeholder:text-[#854F6C]/60 focus:border-[#522B5B]',
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
        'rounded-xl border border-[#DFB6B2] bg-white p-6 shadow-sm',
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
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#854F6C]">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-1 font-sans text-[36px] font-bold text-[#2B124C]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] text-[#854F6C]">{subtitle}</p>
      )}
    </div>
  );
}

export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    info: 'border-[#DFB6B2] bg-[#FBE4D8] text-[#522B5B]',
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
