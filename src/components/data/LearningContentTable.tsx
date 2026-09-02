import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { LearningContentFrame } from '@/types/learningContentFrame'

import { LearningContentPreviewModal } from './LearningContentPreviewModal'

interface LearningContentTableProps {
  frames: LearningContentFrame[]
  onEdit: (id: string, data: Omit<LearningContentFrame, 'id' | 'image'>) => void
  onOpenAnalysis: (frame: LearningContentFrame) => void
  onDelete: (id: string) => void
}

export function LearningContentTable({
  frames,
  onEdit,
  onOpenAnalysis,
  onDelete,
}: LearningContentTableProps) {
  const [previewing, setPreviewing] = useState<LearningContentFrame | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [fileNameDrafts, setFileNameDrafts] = useState<Record<string, string>>({})

  function getFileNameValue(frame: LearningContentFrame) {
    return fileNameDrafts[frame.id] ?? frame.fileName ?? ''
  }

  function handleFileNameChange(frameId: string, value: string) {
    setFileNameDrafts((prev) => ({ ...prev, [frameId]: value }))
  }

  function handleFileNameCommit(frame: LearningContentFrame) {
    const value = fileNameDrafts[frame.id]
    if (value === undefined || value === (frame.fileName ?? '')) return
    const { id, image, ...rest } = frame
    onEdit(id, { ...rest, fileName: value })
  }

  if (frames.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        該当するデータが見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="divide-x divide-gray-200 whitespace-nowrap bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-40 px-3 py-4">ファイル名</th>
              <th className="w-56 px-3 py-4">画像</th>
              <th className="px-3 py-4 text-center">上流血管のサイズ</th>
              <th className="px-3 py-4 text-center">下流血管のサイズ</th>
              <th className="px-3 py-4 text-center">Pd</th>
              <th className="px-3 py-4 text-center">Pa</th>
              <th className="px-3 py-4 text-center">〇〇パラメータ</th>
              <th className="w-32 px-3 py-4" />
            </tr>
          </thead>
          <tbody>
            {frames.map((frame) => (
              <tr key={frame.id} className="divide-x divide-gray-100 border-t border-gray-100">
                <td className="px-3 py-6">
                  <input
                    type="text"
                    value={getFileNameValue(frame)}
                    onChange={(event) => handleFileNameChange(frame.id, event.target.value)}
                    onBlur={() => handleFileNameCommit(frame)}
                    placeholder="ファイル名"
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-gray-900 outline-none hover:border-gray-200 focus:border-indigo-400 focus:bg-white"
                  />
                </td>
                <td className="px-3 py-6">
                  <div className="h-36 w-52 overflow-hidden rounded-lg bg-black">
                    <img src={frame.image} alt="学習内容" className="h-full w-full object-cover" />
                  </div>
                </td>
                <td className="px-3 py-6 text-center text-gray-900">{frame.upstreamSize}</td>
                <td className="px-3 py-6 text-center text-gray-900">{frame.downstreamSize}</td>
                <td className="px-3 py-6 text-center text-gray-900">{frame.pd}</td>
                <td className="px-3 py-6 text-center text-gray-900">{frame.pa}</td>
                <td className="px-3 py-6 text-center text-gray-900">{frame.parameter}</td>
                <td className="px-3 py-6">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewing(frame)}
                      className="rounded p-1 text-amber-500 transition hover:bg-amber-50"
                      title="表示"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAnalysis(frame)}
                      className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(frame.id)}
                      className="rounded p-1 text-red-500 transition hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewing && (
        <LearningContentPreviewModal frame={previewing} onClose={() => setPreviewing(null)} />
      )}

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
    </div>
  )
}
