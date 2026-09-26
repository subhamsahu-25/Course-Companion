// Shared UI primitives — one place for buttons, inputs, cards, badges.
// New pages should use these instead of hand-rolling Tailwind classes so
// the next re-skin is a one-file change. Dark theme: ink majors, cream text.
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary:
      'border border-[#5b86b6]/60 bg-[#3f6593] text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60',
    secondary:
      'border border-[#5b86b6]/60 bg-[#3f6593] text-[#c0e6fd] hover:bg-[#5b86b6] active:scale-[0.98] disabled:opacity-60',
    ghost: 'text-[#80aad3] hover:bg-white/10 hover:text-[#c0e6fd]',
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
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'mt-1 w-full rounded-lg border border-[#3f6593] bg-[#000f22] p-3 text-[15px] text-[#c0e6fd] outline-none placeholder:text-[#80aad3]/50 focus:border-[#5b86b6]',
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
        'rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-sm',
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
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#80aad3]">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-1 font-sans text-[36px] font-bold text-[#c0e6fd]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] text-[#80aad3]">{subtitle}</p>
      )}
    </div>
  );
}
export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'border-red-400/40 bg-red-950/50 text-red-200',
    success: 'border-green-400/40 bg-green-950/50 text-green-200',
    info: 'border-[#3f6593] bg-[#1b3554] text-[#80aad3]',
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

