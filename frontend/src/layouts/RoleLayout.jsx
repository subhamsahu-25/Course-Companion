// frontend/src/layouts/RoleLayout.jsx
import Sidebar from '../components/Sidebar.jsx';
import { linksForRole, nameForRole } from '../utils/roleLinks.js';

export default function RoleLayout({
  role,
  currentPage,
  onPageChange,
  onLogout,
  children,
}) {
  const links = linksForRole(role)
  const roleName = nameForRole(role)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="flex min-h-screen">
        <Sidebar
          role={role}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onLogout={onLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar — the sidebar is desktop-only, so phones need
              their own way to see where they are and log out. */}
          <header className="flex items-center justify-between border-b border-[#D9E1E7] bg-white px-4 py-3 md:hidden">
            <div>
              <div className="text-[17px] font-semibold text-[#1D3557]">
                Course Companion
              </div>
              <div className="text-xs text-[#457B9D]">{roleName}</div>
            </div>

            <button
              onClick={onLogout}
              className="text-sm text-[#457B9D] hover:text-[#1D3557]"
            >
              Log out
            </button>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:px-10 md:py-10 md:pb-10">
            <div className="mx-auto max-w-237.5">{children}</div>
          </main>

          {/* Mobile bottom tab bar — replaces the sidebar's role as primary
              navigation on small screens, fixed so it's always reachable. */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[#D9E1E7] bg-white md:hidden">
            {links.map(([page, text]) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`flex-1 px-2 py-3 text-center text-xs font-medium transition ${
                  currentPage === page
                    ? 'text-[#1D3557]'
                    : 'text-[#8AA0AE]'
                }`}
              >
                {text}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
