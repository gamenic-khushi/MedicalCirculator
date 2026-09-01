import { Menu, Table2, Trash2 } from 'lucide-react'

import type { SavedSnapshot } from '@/types/viewerState'

interface SavedSnapshotsPanelProps {
  savedSnapshots: SavedSnapshot[]
  isTableView: boolean
  onSetTableView: (value: boolean) => void
  onDelete: (id: string) => void
}

export function SavedSnapshotsPanel({
  savedSnapshots,
  isTableView,
  onSetTableView,
  onDelete,
}: SavedSnapshotsPanelProps) {
  if (savedSnapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
        <Table2 className="h-6 w-6 text-gray-300" />
        <p className="text-xs text-gray-400">利用可能なデータがありません</p>
      </div>
    )
  }

  if (isTableView) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <button
            type="button"
            onClick={() => onSetTableView(false)}
            className="text-gray-400 transition hover:text-gray-600"
            title="カード表示に戻る"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <div>
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

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white py-4 pl-4 pr-1 shadow-sm">
      <div className="flex items-center justify-between gap-2 pr-3">
        <span className="text-sm font-semibold text-gray-900">仮保存プレビュー</span>
        <button
          type="button"
          onClick={() => onSetTableView(true)}
          className="text-gray-400 transition hover:text-gray-600"
          title="テーブル表示に切り替える"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      <div className="pill-scrollbar flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-3">
        {savedSnapshots.map((snapshot) => (
          <div
            key={snapshot.id}
            className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">{snapshot.date}</p>
              <button
                type="button"
                onClick={() => onDelete(snapshot.id)}
                className="rounded p-1 text-gray-400 transition hover:text-gray-600"
                title="削除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-hidden rounded-lg bg-gray-800">
              <img src={snapshot.image} alt="保存されたモデル画像" className="w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
