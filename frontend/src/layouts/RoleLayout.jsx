import Sidebar from '../components/Sidebar.jsx'

export default function RoleLayout({
  role,
  currentPage,
  onPageChange,
  onLogout,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="flex min-h-screen">

        <Sidebar
          role={role}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onLogout={onLogout}
        />

        <main className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">
          <div className="mx-auto max-w-237.5">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}