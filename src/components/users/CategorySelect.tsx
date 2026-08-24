import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { UserCategory } from '@/types/user'

import { CATEGORY_CONFIG, CATEGORY_PILL_CLASSES } from './userCategoryConfig'

const CATEGORY_ORDER: UserCategory[] = [
  'system_admin',
  'hospital_admin',
  'hospital_user',
  'learning_admin',
  'learning_user',
]

interface CategorySelectProps {
  value: UserCategory
  onChange: (value: UserCategory) => void
}

export function CategorySelect({ value, onChange }: CategorySelectProps) {
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
        className={
          isOpen
            ? 'flex w-full items-center justify-center rounded-lg bg-gray-100 py-2.5 text-gray-500 transition'
            : `flex w-fit items-center gap-2 rounded-full py-2 pl-4 pr-3 text-sm font-medium text-white transition ${CATEGORY_PILL_CLASSES[value]}`
        }
      >
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <>
            {CATEGORY_CONFIG[value].label}
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg">
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                onChange(category)
                setIsOpen(false)
              }}
              className="block w-full border-b border-gray-100 px-4 py-2.5 text-left text-sm text-gray-700 transition last:border-b-0 hover:bg-gray-50"
            >
              {CATEGORY_CONFIG[category].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
