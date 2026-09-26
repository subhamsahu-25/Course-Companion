// frontend/src/layouts/RoleLayout.jsx
import { useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { linksForRole, nameForRole } from '../utils/roleLinks.js';

export default function RoleLayout({
  role,
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
  const askLogout = () => setConfirmOpen(true);

  return (
    <div className="min-h-screen bg-[#000f22]">
      <div className="flex min-h-screen">
        <Sidebar
          role={role}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onLogout={askLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar — the sidebar is desktop-only, so phones need
              their own way to see where they are and log out. */}
          <header className="flex items-center justify-between border-b border-[#3f6593] bg-[#1b3554] px-4 py-3 md:hidden">
            <div>
              <div className="text-[17px] font-semibold text-[#c0e6fd]">
                Course Companion
              </div>
              <div className="text-xs text-[#80aad3]">{roleName}</div>
            </div>

            <button
              onClick={askLogout}
              className="rounded-md px-2 py-1 text-sm text-[#80aad3] transition-all duration-200 ease-out hover:bg-white/10 hover:text-[#c0e6fd] hover:opacity-80 active:scale-[0.98]"
            >
              Log out
            </button>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:px-10 md:py-10 md:pb-10">
            <div className="mx-auto max-w-237.5">{children}</div>
          </main>

          {/* Mobile bottom tab bar — replaces the sidebar's role as primary
              navigation on small screens, fixed so it's always reachable. */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[#3f6593] bg-[#1b3554] md:hidden">
            {links.map(([page, text]) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`flex-1 px-2 py-3 text-center text-xs font-medium transition-all duration-200 ease-out ${
                  currentPage === page ? 'text-[#c0e6fd]' : 'text-[#80aad3]'
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
          <div className="relative w-full max-w-sm rounded-xl border border-[#3f6593] bg-[#1b3554] p-6 shadow-xl">
            <h2 className="font-sans text-lg font-semibold text-[#c0e6fd]">
              Log out?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#80aad3]">
              You&apos;ll need to sign in again to access your courses.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-[#80aad3] hover:bg-white/10 hover:text-[#c0e6fd] hover:opacity-80"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  onLogout();
                }}
                className="rounded-xl border border-[#5b86b6]/60 bg-[#3f6593] px-5 py-2.5 text-sm font-medium text-[#c0e6fd] hover:bg-[#5b86b6]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


