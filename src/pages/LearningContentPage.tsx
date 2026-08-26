import { Query, type Models } from 'appwrite'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LearningContentTable } from '@/components/data/LearningContentTable'
import { useViewerState } from '@/hooks/useViewerState'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import type { SavedSnapshot } from '@/types/viewerState'

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

function formatFrameDate(createdAt: string | undefined): string {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${datePart} ${timePart}`
}

function frameToSnapshot(frame: LearningContentFrame): SavedSnapshot {
  return {
    id: frame.id,
    image: frame.image,
    date: formatFrameDate(frame.createdAt),
    upstreamSize: frame.upstreamSize,
    downstreamSize: frame.downstreamSize,
    pd: frame.pd,
    pa: frame.pa,
    stenosisRate: frame.stenosisRate ?? '—',
    mla: frame.mla ?? '—',
    lumenVolume: frame.lumenVolume ?? '—',
    bifurcationAngle: frame.bifurcationAngle ?? '—',
  }
}

export function LearningContentPage() {
  const navigate = useNavigate()
  const { setSavedSnapshots } = useViewerState()
  const [frames, setFrames] = useState<LearningContentFrame[]>([])

  useEffect(() => {
    fetchAllFrames().then(setFrames)
  }, [])

  function handleAddNew() {
    setSavedSnapshots(frames.map(frameToSnapshot))
    navigate('/3d-analysis/viewer')
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
