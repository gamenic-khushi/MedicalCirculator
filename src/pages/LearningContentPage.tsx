import { Query, type Models } from 'appwrite'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { LearningContentTable } from '@/components/data/LearningContentTable'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const PAGE_SIZE = 100

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

  return rows.map(({ $id, ...rest }) => ({ id: $id, ...rest }))
}

export function LearningContentPage() {
  const [frames, setFrames] = useState<LearningContentFrame[]>([])

  useEffect(() => {
    fetchAllFrames().then(setFrames)
  }, [])

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
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/data" className="hover:text-gray-700">
          学習データ管理
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">学習内容</span>
      </div>

      <div className="mt-4">
        <LearningContentTable frames={frames} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  )
}
