import { Pencil, Table2, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SideLabel } from '@/components/common/SideLabel'
import { SPACE_COLOR } from '@/components/model-viewer/ViewerEnvironment'
import { EASE_OUT } from '@/lib/motion'
import type { SavedSnapshot } from '@/types/viewerState'

interface SavedSnapshotsPanelProps {
  savedSnapshots: SavedSnapshot[]
  onDelete: (id: string) => void
  // Opens a saved row in the 保存済みキャプチャ view. Without it the 編集 column is left out.
  onEdit?: (snapshot: SavedSnapshot) => void
  onDownloadPdf?: () => void
}

// FFR is Pd divided by Pa, with two decimals (— when either is missing).
function ffrOf(snapshot: SavedSnapshot): string {
  const pd = parseFloat(snapshot.pd)
  const pa = parseFloat(snapshot.pa)
  return pd >= 0 && pa > 0 ? (pd / pa).toFixed(2) : '—'
}

// The columns after the image, in this order (before 編集 and 削除).
const COLUMNS: { label: string; value: (snapshot: SavedSnapshot) => string }[] = [
  { label: '病変近位径', value: (s) => s.upstreamSize },
  { label: '病変遠位径', value: (s) => s.downstreamSize },
  { label: 'Pd', value: (s) => s.pd },
  { label: 'Pa', value: (s) => s.pa },
  { label: 'FFR', value: ffrOf },
  { label: '狭窄率', value: (s) => s.stenosisRate },
  { label: '最小血管径', value: (s) => s.mld ?? '—' },
  { label: '最小断面積', value: (s) => s.mla },
  { label: '狭窄長', value: (s) => s.segmentLength ?? '—' },
  { label: '病変位置', value: (s) => s.lesionPosition ?? '—' },
]

export function SavedSnapshotsPanel({
  savedSnapshots,
  onDelete,
  onEdit,
  onDownloadPdf,
}: SavedSnapshotsPanelProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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
    </div>
  )

  // The name 保存一覧 is the vertical label at the left; the buttons sit on the right.
  const actionsRow = onDownloadPdf && (
    <div className="flex justify-end border-b border-gray-100 p-4">{headerActions}</div>
  )

  if (savedSnapshots.length === 0) {
    return (
      <div className="flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <SideLabel>保存一覧</SideLabel>
        <div className="min-w-0 flex-1">
          {actionsRow}
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Table2 className="h-6 w-6 text-gray-300" />
            <p className="text-xs text-gray-400">利用可能なデータがありません</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <SideLabel>保存一覧</SideLabel>
      <div className="min-w-0 flex-1">
        {actionsRow}
        <div className="pill-scrollbar overflow-x-auto">
          {/* Each column is as narrow as its content; a wide list scrolls sideways. */}
          <table className="w-max min-w-full text-left text-xs">
            <thead>
              <tr className="divide-x divide-gray-200 whitespace-nowrap bg-gray-50 font-medium text-gray-500">
                <th className="px-2 py-3">画像</th>
                {COLUMNS.map((column) => (
                  <th key={column.label} className="px-2 py-3 text-center">
                    {column.label}
                  </th>
                ))}
                {onEdit && <th className="px-2 py-3 text-center">編集</th>}
                <th className="px-2 py-3 text-center">削除</th>
              </tr>
            </thead>
            <tbody>
              {/* A newly saved row slides in at the top; a deleted one fades out.
                Rows already there when the list first shows don't animate. */}
              <AnimatePresence initial={false}>
                {[...savedSnapshots].reverse().map((snapshot) => (
                  <motion.tr
                    key={snapshot.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="divide-x divide-gray-100 whitespace-nowrap border-t border-gray-100"
                  >
                    <td className="px-2 py-3">
                      <p className="mb-1.5 text-gray-500">{snapshot.date}</p>
                      {/* The whole image, as the viewer showed it; the box matches its edges. */}
                      <div
                        className="h-16 w-28 overflow-hidden rounded-lg"
                        style={{ backgroundColor: SPACE_COLOR }}
                      >
                        <img
                          src={snapshot.image}
                          alt="保存されたモデル画像"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.label} className="px-2 py-3 text-center text-gray-900">
                        {column.value(snapshot)}
                      </td>
                    ))}
                    {onEdit && (
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onEdit(snapshot)}
                          title="保存済みキャプチャを開く"
                          className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(snapshot.id)}
                        className="rounded p-1 text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {pendingDeleteId && (
            <ConfirmDialog
              message="本当に削除しますか？"
              onCancel={() => setPendingDeleteId(null)}
              onConfirm={() => {
                onDelete(pendingDeleteId)
                setPendingDeleteId(null)
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
