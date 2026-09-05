const roles = [
  {
    id: 'student',
    title: 'Student',
    description:
      'Browse modules and ask questions against course material.',
  },
  {
    id: 'ta',
    title: 'Teaching Assistant',
    description:
      'Review, edit, and approve AI-drafted answers.',
  },
  {
    id: 'admin',
    title: 'Admin',
    description:
      'Upload material and organise it into modules.',
  },
]

export default function Login({ onLogin }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 sm:px-6">

      <div className="w-full max-w-142.5">

        <div className="mb-8 text-center sm:mb-10 sm:text-left">

          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#457B9D] sm:text-sm">
            Academic Portal
          </div>

          <h1 className="font-serif text-[38px] leading-[1.05] text-[#1D3557] sm:text-[48px] md:text-[56px]">
            Course Companion
            <br />
            Portal
          </h1>

          <p className="mx-auto mt-4 max-w-125 text-[15px] leading-6 text-[#457B9D] sm:mx-0 sm:text-[17px]">
            A simple place to browse course material,
            ask questions, and review answers.
          </p>

        </div>

        <div className="space-y-3">

          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => onLogin(role.id)}
              className="group w-full rounded-xl border border-[#D5DEE5] bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#457B9D] hover:shadow-md sm:px-6 sm:py-5"
            >

              <div className="flex items-center justify-between gap-3">

                <div className="min-w-0">

                  <div className="text-[17px] font-semibold text-[#2B2D42] sm:text-[19px]">
                    {role.title}
                  </div>

                  <div className="mt-1 text-[14px] leading-5 text-[#647D8D] sm:text-[15px] sm:leading-6">
                    {role.description}
                  </div>

                </div>

                <div className="shrink-0 text-lg text-[#457B9D] transition group-hover:translate-x-1 sm:text-xl">
                  →
                </div>

              </div>

            </button>
          ))}

        </div>

      </div>

    </div>
  )
}