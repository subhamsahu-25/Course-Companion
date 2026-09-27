// frontend/src/layouts/RoleLayout.jsx
import { useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { SignOutIcon } from '../components/AccountCard.jsx';
import { LoadingState } from '../components/ui/primitives.jsx';
import { linksForRole, nameForRole } from '../utils/roleLinks.js';

export default function RoleLayout({
  role,
  user,
  currentPage,
  onPageChange,
  onLogout,
  children,
}) {
  const links = linksForRole(role);
  const roleName = nameForRole(role);
  // Logout confirm modal — every logout button (desktop sidebar, mobile
  // drawer, mobile top bar) routes through here so an accidental click
  // never signs the user out.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const askLogout = () => setConfirmOpen(true);
  // Confirming swaps the modal to a "logging you out" wait state while
  // the session teardown runs, instead of hanging on a dead dialog.
  async function confirmLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex min-h-screen">
        <Sidebar
          role={role}
          user={user}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onLogout={askLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar — the sidebar is desktop-only, so phones need
              their own way to see where they are and log out. */}
          <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
            <div>
              <div className="text-[17px] font-semibold text-heading">
                Course Companion
              </div>
              <div className="text-xs text-body">{roleName}</div>
            </div>

            <button
              onClick={askLogout}
              aria-label="Log out"
              className="flex size-10 items-center justify-center rounded-lg text-body transition-all duration-200 ease-out hover:bg-white/10 hover:text-heading active:scale-95"
            >
              <SignOutIcon size={32} />
            </button>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:px-10 md:py-10 md:pb-10">
            <div className="mx-auto max-w-237.5">{children}</div>
          </main>

          {/* Mobile bottom tab bar — replaces the sidebar's role as primary
              navigation on small screens, fixed so it's always reachable. */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden">
            {links.map(([page, text]) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`flex-1 px-2 py-3 text-center text-xs font-medium transition-all duration-200 ease-out ${
                  currentPage === page ? 'text-heading' : 'text-body'
                }`}
              >
                {text}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Logout confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            {loggingOut ? (
              <LoadingState message="Logging you out" compact />
            ) : (
              <>
                <h2 className="font-sans text-lg font-semibold text-heading">
                  Are you sure to log out?
                </h2>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-body hover:bg-white/10 hover:text-heading hover:opacity-80"
                  >
                    Stay
                  </button>
                  <button
                    type="button"
                    onClick={confirmLogout}
                    className="rounded-xl border border-border bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


