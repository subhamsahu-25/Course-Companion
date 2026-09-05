const modules = [
  ['Signals & Systems', 8, 42],
  ['Digital Logic Design', 5, 38],
  ['Electromagnetics', 6, 40],
]

export default function AdminModules({
  onPageChange,
}) {
  return (
    <div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
            Administration
          </div>

          <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
            Modules
          </h1>

          <p className="mt-2 text-[17px] text-[#647D8D]">
            Manage uploaded course material.
          </p>
        </div>

        <button
          onClick={() =>
            onPageChange('admin-upload')
          }
          className="rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F]"
        >
          + Upload material
        </button>

      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">

        {modules.map(
          ([name, documents, students]) => (
            <div
              key={name}
              className="rounded-xl border border-[#D9E1E7] bg-white p-6 shadow-sm"
            >

              <div className="text-[19px] font-semibold text-[#2B2D42]">
                {name}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-5">

                <div className="rounded-lg bg-[#E7F1F6] p-4">
                  <div className="text-[27px] font-bold text-[#1D3557]">
                    {documents}
                  </div>

                  <div className="mt-1 text-sm text-[#457B9D]">
                    documents
                  </div>
                </div>

                <div className="rounded-lg bg-[#F1F5F8] p-4">
                  <div className="text-[27px] font-bold text-[#1D3557]">
                    {students}
                  </div>

                  <div className="mt-1 text-sm text-[#457B9D]">
                    students
                  </div>
                </div>

              </div>

            </div>
          )
        )}

      </div>

    </div>
  )
}