const studentLinks = [
  ['student-dashboard', 'Dashboard'],
  ['student-modules', 'Modules'],
  ['student-ask', 'Ask a question'],
]

const taLinks = [
  ['ta-review', 'Review queue'],
]

const adminLinks = [
  ['admin-modules', 'Modules'],
  ['admin-upload', 'Upload material'],
]

export default function Sidebar({
  role,
  currentPage,
  onPageChange,
  onLogout,
}) {
  let links = studentLinks

  if (role === 'ta') {
    links = taLinks
  }

  if (role === 'admin') {
    links = adminLinks
  }

  let roleName = 'Student'

  if (role === 'ta') {
    roleName = 'Teaching Assistant'
  }

  if (role === 'admin') {
    roleName = 'Admin'
  }

  return (
    <aside className="hidden min-h-screen w-62.5 shrink-0 border-r border-[#D9E1E7] bg-white px-5 py-7 md:block">

      <div className="mb-9 px-2">
        <div className="text-[21px] font-semibold text-[#1D3557]">
          Course Companion
        </div>

        <div className="mt-1 text-[15px] text-[#457B9D]">
          {roleName}
        </div>
      </div>

      <nav className="space-y-1">
        {links.map(([page, text]) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-full rounded-md px-3 py-2.5 text-left text-[15px] transition ${
              currentPage === page
                ? 'bg-[#E7F0F5] font-medium text-[#1D3557]'
                : 'text-[#457B9D] hover:bg-[#F3F7F9]'
            }`}
          >
            {text}
          </button>
        ))}
      </nav>

            <button
        onClick={onLogout}
        className="mt-10 w-full border-t border-[#D9E1E7] px-2 pt-5 text-left text-[15px] text-[#457B9D] hover:text-[#1D3557]"
      >
        Switch role
      </button>

    </aside>
  )
}