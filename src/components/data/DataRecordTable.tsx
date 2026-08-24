import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RowActionIcons } from '@/components/common/RowActionIcons'
import type { DataRecord } from '@/types/dataRecord'

import { DataRecordFormModal } from './DataRecordFormModal'

interface DataRecordTableProps {
  records: DataRecord[]
  folders: string[]
  onEdit: (id: string, data: { file: string; category: string; owner: string }) => void
  onDelete: (id: string) => void
  onDuplicate: (record: DataRecord) => void
  onAddAfter: (record: DataRecord) => void
}

export function DataRecordTable({
  records,
  folders,
  onEdit,
  onDelete,
  onDuplicate,
  onAddAfter,
}: DataRecordTableProps) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<DataRecord | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
        該当するデータが見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500">
              <th className="w-44 px-10 py-3">日付</th>
              <th className="w-72 px-10 py-3">ユーザーカテゴリー</th>
              <th className="w-56 px-10 py-3">ファイル</th>
              <th className="px-10 py-3">所有者</th>
              <th className="w-40 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-gray-100">
                <td className="px-10 py-4 text-gray-500">{record.date}</td>
                <td className="px-10 py-4 text-gray-900">{record.category}</td>
                <td className="px-10 py-4 text-gray-900">{record.file}</td>
                <td className="px-10 py-4 text-gray-900">{record.owner}</td>
                <td className="px-6 py-4">
                  <RowActionIcons
                    copyText={`${window.location.origin}/data/${record.id}`}
                    onView={() => navigate('/data/learning-content')}
                    onEdit={() => setEditing(record)}
                    onDelete={() => setPendingDeleteId(record.id)}
                    onDuplicate={() => onDuplicate(record)}
                    onAdd={() => onAddAfter(record)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <DataRecordFormModal
          title="編集"
          folders={folders}
          initialRecord={editing}
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
