import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { ConferencePaper } from '@/types/conferencePaper'

interface ConferencePaperTableProps {
  papers: ConferencePaper[]
  onDelete: (id: string) => void
}

export function ConferencePaperTable({ papers, onDelete }: ConferencePaperTableProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (papers.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        該当する論文が見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-36 px-8 py-3">日付</th>
              <th className="w-72 px-8 py-3">論文</th>
              <th className="px-8 py-3">タイトル</th>
              <th className="w-20 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.id} className="border-t border-gray-100">
                <td className="px-8 py-4 text-gray-500">{paper.date.replaceAll('-', '/')}</td>
                <td className="px-8 py-4 text-gray-700">{paper.journal}</td>
                <td className="px-8 py-4 text-gray-900">{paper.title}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(paper.id)}
                      className="rounded p-1 text-red-500 transition hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <a
                      href={paper.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-blue-500 transition hover:bg-blue-50"
                      title="開く"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
