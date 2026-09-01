import type { Models } from 'appwrite'
import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AddPaperModal } from '@/components/conference/AddPaperModal'
import { ConferencePaperTable } from '@/components/conference/ConferencePaperTable'
import { databaseService } from '@/services/appwrite/database'
import type { ConferencePaper } from '@/types/conferencePaper'

type ConferencePaperRow = Models.Row & Omit<ConferencePaper, 'id'>

export function ConferencePage() {
  const [papers, setPapers] = useState<ConferencePaper[]>([])
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    databaseService.list<ConferencePaperRow>('conference_papers').then(({ rows }) => {
      setPapers(rows.map(({ $id, ...rest }) => ({ id: $id, ...rest })))
    })
  }, [])

  const filteredPapers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return papers
    return papers.filter(
      (paper) =>
        paper.title.toLowerCase().includes(normalized) ||
        paper.journal.toLowerCase().includes(normalized),
    )
  }, [papers, query])

  async function handleAdd(paper: Omit<ConferencePaper, 'id'>) {
    const row = await databaseService.create<ConferencePaperRow>('conference_papers', paper)
    const { $id, ...rest } = row
    setPapers((prev) => [{ id: $id, ...rest }, ...prev])
  }

  async function handleDelete(id: string) {
    await databaseService.remove('conference_papers', id)
    setPapers((prev) => prev.filter((paper) => paper.id !== id))
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">学会</h1>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition hover:from-blue-700 hover:to-indigo-700"
            title="論文を追加"
          >
            <Plus className="h-4 w-4" />
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
        <ConferencePaperTable papers={filteredPapers} onDelete={handleDelete} />
      </div>

      {isAdding && <AddPaperModal onClose={() => setIsAdding(false)} onAdd={handleAdd} />}
    </div>
  )
}
