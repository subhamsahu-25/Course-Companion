const modules = [
  {
    name: 'Signals & Systems',
    asked: 6,
    done: 5,
    color: '#1D3557',
  },
  {
    name: 'Digital Logic Design',
    asked: 3,
    done: 3,
    color: '#457B9D',
  },
  {
    name: 'Electromagnetics',
    asked: 1,
    done: 0,
    color: '#6C9BB5',
  },
]

export default function StudentDashboard({
  onPageChange,
}) {
  return (
    <div>

      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Student
        </div>

        <h1 className="mt-1 text-[34px] font-bold text-[#2B2D42]">
          Your Dashboard
        </h1>

        <p className="mt-1 text-[17px] text-[#647D8D]">
          Progress across the modules you've engaged with.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">

        {modules.map((module) => {
          const percent = Math.round(
            (module.done /
              Math.max(module.asked, 1)) *
              100
          )

          return (
            <div
              key={module.name}
              className="rounded-2xl p-6 text-white shadow-sm"
              style={{
                backgroundColor: module.color,
              }}
            >

              <div className="text-[21px] font-semibold">
                {module.name}
              </div>

              <p className="mt-2 text-[15px] text-white/85">
                {module.done} of {module.asked}{' '}
                questions answered
              </p>

              <div className="mt-5 h-2 rounded-full bg-white/25">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{
                    width: `${percent}%`,
                  }}
                />
              </div>

              <div className="mt-2 text-right text-xs text-white/80">
                {percent}% complete
              </div>

            </div>
          )
        })}

        <button
          onClick={() =>
            onPageChange('student-modules')
          }
          className="min-h-37.5 rounded-2xl border-2 border-dashed border-[#B7C8D3] bg-white p-6 text-center text-[17px] text-[#457B9D] transition hover:border-[#457B9D] hover:bg-[#F5F9FB]"
        >
          <div className="text-2xl">
            +
          </div>

          <div className="mt-2">
            Browse more modules
          </div>
        </button>

      </div>

      <div className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-5">

        <div className="text-[16px] font-semibold text-[#1D3557]">
          Quick note
        </div>

        <p className="mt-1 text-[15px] leading-6 text-[#647D8D]">
          Questions are reviewed by a teaching assistant
          before answers are published.
        </p>

      </div>

    </div>
  )
}