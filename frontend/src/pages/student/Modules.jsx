const modules = [
  [
    'Signals & Systems',
    8,
    'Fourier analysis, LTI systems, sampling.',
  ],
  [
    'Digital Logic Design',
    5,
    'Combinational and sequential circuits.',
  ],
  [
    'Electromagnetics',
    6,
    "Maxwell's equations and wave propagation.",
  ],
]

export default function StudentModules({
  onPageChange,
}) {
  return (
    <div>

      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Course material
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
          Modules
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Browse uploaded course material by module.
        </p>
      </div>

      <div className="mt-8 space-y-4">

        {modules.map(
          ([name, documents, description]) => (
            <div
              key={name}
              className="flex flex-col gap-4 rounded-xl border border-[#C9D9E3] bg-[#E7F1F6] p-5 sm:flex-row sm:items-center"
            >

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-xl text-[#457B9D] shadow-sm">
                📄
              </div>

              <div className="flex-1">

                <div className="text-[19px] font-semibold text-[#2B2D42]">
                  {name}
                </div>

                <div className="mt-1 text-[15px] text-[#536F81]">
                  {description}
                </div>

                <div className="mt-1 text-xs text-[#7390A1]">
                  {documents} documents
                </div>

              </div>

              <button
                onClick={() =>
                  onPageChange('student-ask')
                }
                className="rounded-md border border-[#AFC4D1] bg-white px-5 py-2 text-sm font-medium text-[#1D3557] hover:bg-[#F6FAFC]"
              >
                Ask
              </button>

            </div>
          )
        )}

      </div>

    </div>
  )
}