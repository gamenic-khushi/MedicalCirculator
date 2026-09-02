import { Query, type Models } from 'appwrite'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { LearningContentTable } from '@/components/data/LearningContentTable'
import { useModel3D } from '@/hooks/useModel3D'
import { pickModelFile } from '@/lib/filePickerMemory'
import { databaseService } from '@/services/appwrite/database'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import { createModel3DFile } from '@/types/model'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>

const PAGE_SIZE = 100
const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = '２D心弁解析'

async function fetchFrames(dataRecordId?: string): Promise<LearningContentFrame[]> {
  const rows: LearningContentFrameRow[] = []
  let offset = 0

  while (true) {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(PAGE_SIZE), Query.offset(offset)]
    if (dataRecordId) queries.push(Query.equal('dataRecordId', dataRecordId))

    const page = await databaseService.list<LearningContentFrameRow>(
      'learning_content_frames',
      queries,
    )
    rows.push(...page.rows)
    if (page.rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows.map(({ $id, $createdAt, ...rest }) => ({ id: $id, createdAt: $createdAt, ...rest }))
}

export function LearningContentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dataRecordId = (location.state as { dataRecordId?: string } | null)?.dataRecordId
  const { setModel } = useModel3D()
  const [frames, setFrames] = useState<LearningContentFrame[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFrames(dataRecordId)
      .then(setFrames)
      .catch((error) => console.error(error))
  }, [dataRecordId])

  function loadFile(file: File) {
    setModel(createModel3DFile(file, { folder: DEFAULT_FOLDER, studyName: DEFAULT_STUDY_NAME }))
    navigate('/data/lesion-measurement', { state: { dataRecordId } })
  }

  async function handleAddNew() {
    const file = await pickModelFile(() => inputRef.current?.click())
    if (file) loadFile(file)
  }

  function handleFileSelected(files: FileList | null) {
    if (!files?.length) return
    loadFile(files[0])
  }

  async function handleEdit(id: string, data: Omit<LearningContentFrame, 'id' | 'image'>) {
    await databaseService.update<LearningContentFrameRow>('learning_content_frames', id, data)
    setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, ...data } : frame)))
  }

  async function handleDelete(id: string) {
    await databaseService.remove('learning_content_frames', id)
    setFrames((prev) => prev.filter((frame) => frame.id !== id))
  }

  function handleOpenAnalysis(frame: LearningContentFrame) {
    navigate('/data/lesion-measurement/analysis', { state: { dataRecordId, viewFrame: frame } })
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
        <input
          ref={inputRef}
          type="file"
          accept=".fbx,.stl,.obj"
          className="hidden"
          onChange={(event) => handleFileSelected(event.target.files)}
        />
      </div>

      <div className="mt-4">
        <LearningContentTable
          frames={frames}
          onEdit={handleEdit}
          onOpenAnalysis={handleOpenAnalysis}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
