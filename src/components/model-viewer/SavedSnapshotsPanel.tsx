import { Download, Pencil, Table2, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FrameImage } from '@/components/common/FrameImage'
import { LoadingState } from '@/components/common/LoadingState'
import { SideLabel } from '@/components/common/SideLabel'
import { SPACE_COLOR } from '@/components/model-viewer/ViewerEnvironment'
import { EASE_OUT } from '@/lib/motion'
import { SNAPSHOT_COLUMNS } from '@/lib/snapshotColumns'
import type { SavedSnapshot } from '@/types/viewerState'

interface SavedSnapshotsPanelProps {
  savedSnapshots: SavedSnapshot[]
  // The list is still on its way: say so instead of "no data".
  isLoading?: boolean
  onDelete: (id: string) => void
  // Opens a saved row in the 保存済みキャプチャ view. Without it the 編集 column is left out.
  onEdit?: (snapshot: SavedSnapshot) => void
  onDownloadPdf?: () => void
}

// The picture column fits the picture (w-28 = 7rem) and its padding; the others are at least
// this wide, so the headings (nowrap) are never cut.
const PICTURE_COLUMN = '8rem'
const MIN_COLUMN = '5rem'

export function SavedSnapshotsPanel({
  savedSnapshots,
  isLoading = false,
  onDelete,
  onEdit,
  onDownloadPdf,
}: SavedSnapshotsPanelProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Every column but the picture shares the width left over equally: the values, 編集, 削除.
  const valueColumnCount = SNAPSHOT_COLUMNS.length + (onEdit ? 1 : 0) + 1

  // The PDF download is an icon under the index tab (Aki, 2026/11/25), in the empty strip at
  // the left edge of the block; the name 解析結果一覧 is the tab itself.
  const downloadIcon = onDownloadPdf && (
    <button
      type="button"
      onClick={onDownloadPdf}
      title="PDFダウンロード"
      aria-label="PDFダウンロード"
      className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  )

  if (savedSnapshots.length === 0 && isLoading) {
    return (
      <div className="flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <SideLabel below={downloadIcon}>解析結果一覧</SideLabel>
        <div className="min-w-0 flex-1">
          <LoadingState />
        </div>
      </div>
    )
  }

  if (savedSnapshots.length === 0) {
    return (
      <div className="flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <SideLabel below={downloadIcon}>解析結果一覧</SideLabel>
        <div className="min-w-0 flex-1">
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
      <SideLabel below={downloadIcon}>解析結果一覧</SideLabel>
      <div className="min-w-0 flex-1">
        <div className="pill-scrollbar overflow-x-auto">
          {/* Aki 11/24: the picture column is as wide as the picture and the value columns are all
              the same width; Aki 11/25: the table fills the whole width (no empty space on the
              right) and 編集 / 削除 are as wide as the other columns. A list that is too wide for the
              space scrolls sideways. */}
          <table
            className="w-full table-fixed text-left text-xs"
            style={{ minWidth: `calc(${PICTURE_COLUMN} + ${valueColumnCount} * ${MIN_COLUMN})` }}
          >
            <colgroup>
              <col style={{ width: PICTURE_COLUMN }} />
              {Array.from({ length: valueColumnCount }, (_, index) => (
                <col key={index} />
              ))}
            </colgroup>
            <thead>
              <tr className="divide-x divide-gray-200 whitespace-nowrap bg-gray-50 font-medium text-gray-500">
                <th className="px-2 py-3">画像</th>
                {SNAPSHOT_COLUMNS.map((column) => (
                  <th key={column.label} className="min-w-[5rem] px-1 py-3 text-center">
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
                      <FrameImage
                        frameId={snapshot.id}
                        image={snapshot.image}
                        alt="保存されたモデル画像"
                        className="h-16 w-28 rounded-lg"
                        style={{ backgroundColor: SPACE_COLOR }}
                      />
                    </td>
                    {SNAPSHOT_COLUMNS.map((column) => (
                      <td key={column.label} className="min-w-[5rem] px-1 py-3 text-center text-gray-900">
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
