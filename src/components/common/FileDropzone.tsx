import { useRef, useState } from 'react'

interface FileDropzoneProps {
  buttonLabel: string
  description: string
  hint?: string
  accept?: string
  compact?: boolean
  buttonVariant?: 'solid' | 'outline'
  onFilesSelected?: (files: FileList) => void
}

const BUTTON_VARIANT_CLASSES: Record<'solid' | 'outline', string> = {
  solid: 'rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700',
  outline: 'rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50',
}

export function FileDropzone({
  buttonLabel,
  description,
  hint,
  accept,
  compact = false,
  buttonVariant = 'solid',
  onFilesSelected,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        if (event.dataTransfer.files.length > 0) {
          onFilesSelected?.(event.dataTransfer.files)
        }
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors ${
        compact ? 'h-36' : 'h-56'
      } ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-blue-200 bg-blue-50/40'}`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`px-5 py-2.5 text-sm font-medium transition ${BUTTON_VARIANT_CLASSES[buttonVariant]}`}
      >
        {buttonLabel}
      </button>
      <p className="text-sm text-gray-600">{description}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            onFilesSelected?.(event.target.files)
          }
        }}
      />
    </div>
  )
}
