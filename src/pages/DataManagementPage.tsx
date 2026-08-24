import type { Models } from 'appwrite'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import vectorIcon from '@/assets/SVG/Vector.svg'
import { DataRecordTable } from '@/components/data/DataRecordTable'
import { databaseService } from '@/services/appwrite/database'
import type { DataRecord } from '@/types/dataRecord'

type DataRecordRow = Models.Row & Omit<DataRecord, 'id'>

function todayDisplayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}/${month}/${day}`
}

export function DataManagementPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<DataRecord[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    databaseService.list<DataRecordRow>('data_records').then(({ rows }) => {
      const loaded = rows.map(({ $id, ...rest }) => ({ id: $id, ...rest }))
      setRecords(loaded)
    })
  }, [])

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return records
    return records.filter(
      (record) =>
        record.category.toLowerCase().includes(normalized) ||
        record.owner.toLowerCase().includes(normalized),
    )
  }, [records, query])

  function handleAddAfter() {
    navigate('/data/lesion-measurement')
  }

  async function handleDelete(id: string) {
    await databaseService.remove('data_records', id)
    setRecords((prev) => prev.filter((record) => record.id !== id))
  }

  async function handleDuplicate(record: DataRecord) {
    const row = await databaseService.create<DataRecordRow>('data_records', {
      date: todayDisplayDate(),
      category: record.category,
      file: record.file,
      owner: record.owner,
    })
    const { $id, ...rest } = row
    setRecords((prev) => {
      const index = prev.findIndex((item) => item.id === record.id)
      const next = [...prev]
      next.splice(index + 1, 0, { id: $id, ...rest })
      return next
    })
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">学習データ管理</h1>
          <button
            type="button"
            onClick={() => navigate('/3d-analysis')}
            className="flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            <img src={vectorIcon} alt="アップロード" className="h-4 w-4" />
            新規追加
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="検索"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="mt-6">
        <DataRecordTable
          records={filteredRecords}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onAddAfter={handleAddAfter}
        />
      </div>
    </div>
  )
}
