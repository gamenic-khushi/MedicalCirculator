import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

import { useUpdateAvailable } from '@/hooks/useUpdateAvailable'

// Offered instead of reloading by itself: a reload would throw away whatever
// the user is in the middle of (selected points, unsaved measurements).
export function UpdateBanner() {
  const latestId = useUpdateAvailable()
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  if (!latestId || latestId === dismissedId) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ring-gray-200">
      <RefreshCw className="h-5 w-5 shrink-0 text-indigo-500" />
      <div className="text-sm text-gray-900">
        <p className="font-medium">新しいバージョンがあります</p>
        <p className="text-xs text-gray-500">更新すると画面が再読み込みされます（保存していない内容は失われます）。</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
      >
        更新する
      </button>
      <button
        type="button"
        onClick={() => setDismissedId(latestId)}
        aria-label="閉じる"
        title="閉じる"
        className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
