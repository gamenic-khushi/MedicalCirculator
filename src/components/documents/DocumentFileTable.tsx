import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RowActionIcons } from '@/components/common/RowActionIcons'
import type { DocumentFile } from '@/types/documentFile'

import { DocumentEditModal } from './DocumentEditModal'
import { DocumentPreviewModal } from './DocumentPreviewModal'

interface DocumentFileTableProps {
  documents: DocumentFile[]
  folders: string[]
  onEdit: (id: string, data: { folder: string; fileName: string }) => void
  onDelete: (id: string) => void
  onDuplicate: (document: DocumentFile) => void
}

export function DocumentFileTable({
  documents,
  folders,
  onEdit,
  onDelete,
  onDuplicate,
}: DocumentFileTableProps) {
  const [previewing, setPreviewing] = useState<DocumentFile | null>(null)
  const [editing, setEditing] = useState<DocumentFile | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        該当する資料が見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-48 px-10 py-3">日付</th>
              <th className="px-10 py-3">ファイル名</th>
              <th className="w-40 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="border-t border-gray-100">
                <td className="px-10 py-4 text-gray-500">{document.date}</td>
                <td className="px-10 py-4 text-gray-900">
                  <div className="flex items-center gap-3">
                    {document.imageUrl && (
                      <img
                        src={document.imageUrl}
                        alt={document.fileName}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    {document.fileName}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <RowActionIcons
                    copyText={`${window.location.origin}/documents/${document.id}`}
                    onView={() => setPreviewing(document)}
                    onEdit={() => setEditing(document)}
                    onDelete={() => setPendingDeleteId(document.id)}
                    onDuplicate={() => onDuplicate(document)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewing && (
        <DocumentPreviewModal document={previewing} onClose={() => setPreviewing(null)} />
      )}

      {editing && (
        <DocumentEditModal
          document={editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onSave={(data) => onEdit(editing.id, data)}
        />
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
