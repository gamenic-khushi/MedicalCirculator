import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface FolderSelectProps {
  value: string
  folders: string[]
  onChange: (value: string) => void
}

export function FolderSelect({ value, folders, onChange }: FolderSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg bg-gray-100 px-4 py-3 text-left text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-indigo-400"
      >
        <span className={value ? '' : 'text-gray-400'}>{value || 'フォルダがありません'}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg">
          {folders.length > 0 ? (
            folders.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name)
                  setIsOpen(false)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
              >
                {name}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">フォルダがありません</div>
          )}
        </div>
      )}
    </div>
  )
}
