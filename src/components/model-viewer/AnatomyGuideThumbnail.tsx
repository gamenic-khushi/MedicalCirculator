import { Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import arteryImage from '@/assets/image/artery.png'

export function AnatomyGuideThumbnail() {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isExpanded) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsExpanded(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isExpanded])

  return (
    <div className="absolute bottom-4 left-4 w-28 rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-600">
        解剖学ガイド
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="text-gray-400 transition hover:text-gray-600"
          title="拡大表示"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-1 h-14 w-full overflow-hidden rounded bg-gray-50">
        <img src={arteryImage} alt="解剖学ガイド" className="h-full w-full object-cover" />
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setIsExpanded(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md"
          >
            <h2 className="mb-3 text-sm font-semibold text-white">Anatomy Guide</h2>

            <div className="relative rounded-2xl bg-white p-4 shadow-xl">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="overflow-hidden rounded-lg">
                <img
                  src={arteryImage}
                  alt="Anatomy Guide"
                  className="w-full scale-105 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
