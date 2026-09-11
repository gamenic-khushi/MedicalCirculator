import { Query, type Models } from 'appwrite'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Toast } from '@/components/common/Toast'
import { LearningContentTable } from '@/components/data/LearningContentTable'
import { useModel3D } from '@/hooks/useModel3D'
import { appwriteConfig } from '@/services/appwrite/config'
import { databaseService } from '@/services/appwrite/database'
import { storageService } from '@/services/appwrite/storage'
import type { DataRecord } from '@/types/dataRecord'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import { createModel3DFile } from '@/types/model'

const TOAST_DURATION_MS = 2400

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>
type DataRecordRow = Models.Row & Omit<DataRecord, 'id'>

const PAGE_SIZE = 100
const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = '２D心弁解析'

// Every folder's ✏️ shows the same shared list of captures for now, rather
// than each folder's own separate data — per Aki-san's note that this is
// fine short-term, so this intentionally does not filter by dataRecordId.
async function fetchFrames(): Promise<LearningContentFrame[]> {
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
  const location = useLocation()
  const dataRecordId = (location.state as { dataRecordId?: string } | null)?.dataRecordId
  const { setModel } = useModel3D()
  const [frames, setFrames] = useState<LearningContentFrame[]>([])
  const [record, setRecord] = useState<DataRecord | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchFrames()
      .then(setFrames)
      .catch((error) => console.error(error))
  }, [])

  useEffect(() => {
    if (!dataRecordId) {
      setRecord(null)
      return
    }
    databaseService
      .get<DataRecordRow>('data_records', dataRecordId)
      .then(({ $id, ...rest }) => setRecord({ id: $id, ...rest }))
      .catch((error) => console.error(error))
  }, [dataRecordId])

  function loadFile(file: File) {
    setModel(createModel3DFile(file, { folder: DEFAULT_FOLDER, studyName: DEFAULT_STUDY_NAME }))
    navigate('/data/lesion-measurement/analysis', { state: { dataRecordId } })
  }

  async function handleAddNew() {
    if (!record?.modelFileId) {
      setToastMessage('このフォルダにはモデルファイルが登録されていません')
      setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
      return
    }

    const viewUrl = storageService.getViewUrl(appwriteConfig.bucketId, record.modelFileId)
    const response = await fetch(viewUrl)
    const blob = await response.blob()
    const file = new File([blob], record.file, { type: blob.type })
    loadFile(file)
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
        <span className="text-2xl font-bold text-gray-900">{record?.category ?? DEFAULT_STUDY_NAME}</span>
        <button
          type="button"
          onClick={handleAddNew}
          title="新規追加"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition hover:from-blue-700 hover:to-indigo-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {record && (
        <p className="mt-1 text-sm text-gray-400">
          {record.file} ・ {record.date} ・ {record.owner}
        </p>
      )}

      <div className="mt-4">
        <LearningContentTable
          frames={frames}
          onEdit={handleEdit}
          onOpenAnalysis={handleOpenAnalysis}
          onDelete={handleDelete}
        />
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
