import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RowActionIcons } from '@/components/common/RowActionIcons'
import type { DataRecord } from '@/types/dataRecord'

interface DataRecordTableProps {
  records: DataRecord[]
  onDelete: (id: string) => void
  onDuplicate: (record: DataRecord) => void
}

export function DataRecordTable({ records, onDelete, onDuplicate }: DataRecordTableProps) {
  const navigate = useNavigate()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function openLearningContent() {
    navigate('/data/learning-content')
  }

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
              <th className="w-72 px-10 py-3">学習名</th>
              <th className="px-10 py-3">登録者</th>
              <th className="w-40 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-gray-100">
                <td className="px-10 py-4 text-gray-500">{record.date}</td>
                <td className="px-10 py-4 text-gray-900">{record.category}</td>
                <td className="px-10 py-4 text-gray-900">{record.owner}</td>
                <td className="px-6 py-4">
                  <RowActionIcons
                    copyText={`${window.location.origin}/data/${record.id}`}
                    onEdit={openLearningContent}
                    onDelete={() => setPendingDeleteId(record.id)}
                    onDuplicate={() => onDuplicate(record)}
                  />
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
