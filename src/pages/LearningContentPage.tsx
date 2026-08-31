import { Query, type Models } from 'appwrite'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LearningContentTable } from '@/components/data/LearningContentTable'
import { useModel3D } from '@/hooks/useModel3D'
import { loadDefaultModel } from '@/lib/defaultModel'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const PAGE_SIZE = 100
const DEFAULT_STUDY_NAME = '２D心弁解析'

async function fetchAllFrames(): Promise<LearningContentFrame[]> {
  const rows: LearningContentFrameRow[] = []
  let offset = 0

  while (true) {
    const page = await databaseService.list<LearningContentFrameRow>('learning_content_frames', [
      Query.orderDesc('$createdAt'),
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ])
    rows.push(...page.rows)
    if (page.rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows.map(({ $id, $createdAt, ...rest }) => ({ id: $id, createdAt: $createdAt, ...rest }))
}

export function LearningContentPage() {
  const navigate = useNavigate()
  const { model, setModel } = useModel3D()
  const [frames, setFrames] = useState<LearningContentFrame[]>([])

  useEffect(() => {
    fetchAllFrames().then(setFrames)
  }, [])

  async function handleAddNew() {
    const validModel = model && model.file instanceof File ? model : null
    if (!validModel) {
      setModel(await loadDefaultModel())
    }
    navigate('/data/lesion-measurement')
  }

  async function handleEdit(id: string, data: Omit<LearningContentFrame, 'id' | 'image'>) {
    await databaseService.update<LearningContentFrameRow>('learning_content_frames', id, data)
    setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, ...data } : frame)))
  }

  async function handleDelete(id: string) {
    await databaseService.remove('learning_content_frames', id)
    setFrames((prev) => prev.filter((frame) => frame.id !== id))
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="mt-3 flex items-center gap-2">
        <span className="text-2xl font-bold text-gray-900">{DEFAULT_STUDY_NAME}</span>
        <button
          type="button"
          onClick={handleAddNew}
          title="新規追加"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition hover:from-blue-700 hover:to-indigo-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4">
        <LearningContentTable frames={frames} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  )
}
