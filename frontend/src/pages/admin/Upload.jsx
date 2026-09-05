import { useState } from 'react'

const modules = [
  'Signals & Systems',
  'Digital Logic Design',
  'Electromagnetics',
]

export default function AdminUpload() {
  const [selectedModule, setSelectedModule] =
    useState(modules[0])

  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState(false)

  function addFiles(fileList) {
    setError('')
    setUploaded(false)

    const selectedFiles = Array.from(fileList)

    for (const file of selectedFiles) {
      const validType =
        file.type === 'application/pdf' ||
        file.type === 'text/plain'

      if (!validType) {
        setError(
          `${file.name} is not a PDF or text file.`
        )
        return
      }

      if (file.size > 20 * 1024 * 1024) {
        setError(
          `${file.name} is bigger than 20MB.`
        )
        return
      }
    }

    setFiles((oldFiles) => [
      ...oldFiles,
      ...selectedFiles,
    ])
  }

  function removeFile(index) {
    setFiles((oldFiles) =>
      oldFiles.filter((_, fileIndex) => {
        return fileIndex !== index
      })
    )
  }

  function uploadFiles() {
    if (files.length === 0) {
      return
    }

    setUploaded(true)
  }

  return (
    <div>

      <div>
        <div className="text-sm font-medium uppercase tracking-[0.12em] text-[#457B9D]">
          Administration
        </div>

        <h1 className="mt-1 font-serif text-[36px] text-[#1D3557]">
          Upload material
        </h1>

        <p className="mt-2 text-[17px] text-[#647D8D]">
          Add course documents to a module.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[#D9E1E7] bg-white p-6 shadow-sm">

        <label
          htmlFor="module"
          className="block text-sm font-medium text-[#2B2D42]"
        >
          Module
        </label>

        <select
          id="module"
          value={selectedModule}
          onChange={(event) =>
            setSelectedModule(event.target.value)
          }
          className="mt-2 w-full rounded-md border border-[#C8D6DF] bg-white p-3 text-sm text-[#2B2D42] outline-none focus:border-[#457B9D]"
        >
          {modules.map((module) => (
            <option
              key={module}
              value={module}
            >
              {module}
            </option>
          ))}
        </select>

        <label
          htmlFor="files"
          className="mt-6 block cursor-pointer rounded-xl border-2 border-dashed border-[#B9CAD5] bg-[#F8FAFB] p-10 text-center transition hover:border-[#457B9D] hover:bg-[#F3F8FA]"
        >

          <div className="text-3xl text-[#457B9D]">
            ↑
          </div>

          <div className="mt-2 text-[17px] font-medium text-[#2B2D42]">
            Choose files to upload
          </div>

          <div className="mt-1 text-sm text-[#78909F]">
            PDF or TXT, maximum 20MB each
          </div>

          <input
            id="files"
            type="file"
            multiple
            accept=".pdf,.txt"
            className="hidden"
            onChange={(event) =>
              addFiles(event.target.files)
            }
          />

        </label>

        {error && (
          <div className="mt-4 rounded-lg border border-[#F1CACA] bg-[#FFF2F2] p-3 text-sm text-[#A33A3A]">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-5">

            <div className="mb-2 text-sm font-medium text-[#2B2D42]">
              Selected files
            </div>

            <div className="space-y-2">

              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[#D9E1E7] bg-[#F8FAFB] p-3"
                >

                  <div className="min-w-0">
                    <div className="truncate text-sm text-[#2B2D42]">
                      {file.name}
                    </div>

                    <div className="mt-1 text-xs text-[#78909F]">
                      {(
                        file.size /
                        1024 /
                        1024
                      ).toFixed(1)}{' '}
                      MB
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      removeFile(index)
                    }
                    className="shrink-0 text-sm text-[#457B9D] hover:text-[#1D3557]"
                  >
                    Remove
                  </button>

                </div>
              ))}

            </div>

          </div>
        )}

        <button
          onClick={uploadFiles}
          disabled={!files.length}
          className="mt-6 rounded-md bg-[#1D3557] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#28476F] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add to module
        </button>

        {uploaded && (
          <div className="mt-4 rounded-lg border border-[#B8D5E4] bg-[#EAF4F8] p-3 text-sm text-[#1D3557]">
            Files added to {selectedModule}.
          </div>
        )}

      </div>

    </div>
  )
}