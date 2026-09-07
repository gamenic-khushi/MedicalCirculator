import { Table2, Trash2 } from 'lucide-react'

import type { SavedSnapshot } from '@/types/viewerState'

interface SavedSnapshotsPanelProps {
  savedSnapshots: SavedSnapshot[]
  onDelete: (id: string) => void
  onDownloadPdf?: () => void
  onSaveToHistory?: () => void
  canSaveToHistory?: boolean
}

export function SavedSnapshotsPanel({
  savedSnapshots,
  onDelete,
  onDownloadPdf,
  onSaveToHistory,
  canSaveToHistory,
}: SavedSnapshotsPanelProps) {
  const headerActions = (
    <div className="flex items-center gap-2">
      {onDownloadPdf && (
        <button
          type="button"
          onClick={onDownloadPdf}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
        >
          PDFダウンロード
        </button>
      )}
      {onSaveToHistory && (
        <button
          type="button"
          onClick={onSaveToHistory}
          disabled={!canSaveToHistory}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          解析履歴に保存
        </button>
      )}
    </div>
  )

  if (savedSnapshots.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4">
          <span className="text-sm font-semibold text-gray-900">仮保存一覧</span>
          {headerActions}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <Table2 className="h-6 w-6 text-gray-300" />
          <p className="text-xs text-gray-400">利用可能なデータがありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4">
        <span className="text-sm font-semibold text-gray-900">仮保存一覧</span>
        {headerActions}
      </div>
      <div className="pill-scrollbar overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="divide-x divide-gray-200 whitespace-nowrap bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-56 px-3 py-4">画像</th>
              <th className="px-3 py-4 text-center">上流血管のサイズ</th>
              <th className="px-3 py-4 text-center">下流血管のサイズ</th>
              <th className="px-3 py-4 text-center">Pd</th>
              <th className="px-3 py-4 text-center">Pa</th>
              <th className="w-16 px-3 py-4" />
            </tr>
          </thead>
          <tbody>
            {[...savedSnapshots].reverse().map((snapshot) => (
              <tr key={snapshot.id} className="divide-x divide-gray-100 border-t border-gray-100">
                <td className="px-3 py-4">
                  <p className="mb-2 text-xs text-gray-500">{snapshot.date}</p>
                  <div className="h-20 w-32 overflow-hidden rounded-lg bg-gray-800">
                    <img
                      src={snapshot.image}
                      alt="保存されたモデル画像"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </td>
                <td className="px-3 py-4 text-center text-gray-900">{snapshot.upstreamSize}</td>
                <td className="px-3 py-4 text-center text-gray-900">{snapshot.downstreamSize}</td>
                <td className="px-3 py-4 text-center text-gray-900">{snapshot.pd}</td>
                <td className="px-3 py-4 text-center text-gray-900">{snapshot.pa}</td>
                <td className="px-3 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(snapshot.id)}
                    className="rounded p-1 text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
