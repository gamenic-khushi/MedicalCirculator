import { Query, type Models } from 'appwrite'
import { AnimatePresence } from 'motion/react'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { Toast } from '@/components/common/Toast'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { LearningContentTable } from '@/components/data/LearningContentTable'
import { useGuidanceDismissed } from '@/hooks/useGuidanceDismissed'
import { useModel3D } from '@/hooks/useModel3D'
import { useToast } from '@/hooks/useToast'
import { getFramePicture, loadWithoutPictures } from '@/lib/frameImages'
import { LOAD_FAILED, LOADING_DATA, LOADING_MODEL, SAVE_FAILED } from '@/lib/messages'
import { fetchFolderModelFile } from '@/lib/fetchFolderModel'
import { appwriteConfig } from '@/services/appwrite/config'
import { databaseService } from '@/services/appwrite/database'
import { storageService } from '@/services/appwrite/storage'
import type { DataRecord } from '@/types/dataRecord'
import type { LearningContentFrame } from '@/types/learningContentFrame'
import { createModel3DFile } from '@/types/model'

type LearningContentFrameRow = Models.Row & Omit<LearningContentFrame, 'id'>
type DataRecordRow = Models.Row & Omit<DataRecord, 'id'>

const PAGE_SIZE = 100
const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = '２D心弁解析'

// A folder's ✏️ shows the captures saved in that folder only (until 2026/11/17 every
// folder showed the same shared list, which was fine short-term per Aki-san, but a new
// folder then listed everyone's captures). Without a folder (opened directly) it shows
// them all, as before.
// The rows come without their pictures (the table fetches each as it comes into view),
// so the list itself is quick however many captures there are.
async function fetchFrames(dataRecordId?: string): Promise<LearningContentFrame[]> {
  const rows = await loadWithoutPictures(async (columns) => {
    const all: LearningContentFrameRow[] = []
    let offset = 0
    while (true) {
      const page = await databaseService.list<LearningContentFrameRow>('learning_content_frames', [
        ...(dataRecordId ? [Query.equal('dataRecordId', dataRecordId)] : []),
        ...columns,
        Query.orderDesc('$createdAt'),
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ])
      all.push(...page.rows)
      if (page.rows.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
    return all
  })

  return rows.map(({ $id, $createdAt, image, ...rest }) => ({
    id: $id,
    createdAt: $createdAt,
    image: image ?? '',
    ...rest,
  }))
}

export function LearningContentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dataRecordId = (location.state as { dataRecordId?: string } | null)?.dataRecordId
  const { setModel } = useModel3D()
  const [frames, setFrames] = useState<LearningContentFrame[]>([])
  const [record, setRecord] = useState<DataRecord | null>(null)
  const [isLoadingRecord, setIsLoadingRecord] = useState(Boolean(dataRecordId))
  // Which folder's list has arrived; the list is loading until it is the one asked for.
  const [framesArrivedFor, setFramesArrivedFor] = useState<string | null>(null)
  const isLoadingFrames = framesArrivedFor !== (dataRecordId ?? '')
  // Something the user waits on (the folder's 3D model coming in, a picture opening).
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const { toast, showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const { isDismissed: isReuseHintDismissed, dismiss: dismissReuseHint } = useGuidanceDismissed(
    'learning-content-reuse-hint',
  )

  useEffect(() => {
    let current = true
    fetchFrames(dataRecordId)
      .then((loaded) => {
        if (current) setFrames(loaded)
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (current) setFramesArrivedFor(dataRecordId ?? '')
      })
    return () => {
      current = false
    }
  }, [dataRecordId])

  useEffect(() => {
    if (!dataRecordId) {
      setRecord(null)
      setIsLoadingRecord(false)
      return
    }
    setIsLoadingRecord(true)
    databaseService
      .get<DataRecordRow>('data_records', dataRecordId)
      .then(({ $id, ...rest }) => setRecord({ id: $id, ...rest }))
      .catch((error) => console.error(error))
      .finally(() => setIsLoadingRecord(false))
  }, [dataRecordId])

  function loadFile(file: File) {
    // The record's own name (it may have been renamed on the lesion page).
    setModel(
      createModel3DFile(file, {
        folder: DEFAULT_FOLDER,
        studyName: record?.category || DEFAULT_STUDY_NAME,
      }),
    )
    navigate('/data/lesion-measurement/analysis', { state: { dataRecordId } })
  }

  // A folder created before model files were persisted to Storage has no
  // modelFileId to reuse. Rather than leaving the user stuck, let them pick
  // a file this one time and register it as the folder's model — every "+"
  // after that reuses it like normal, same as a folder created going forward.
  async function registerAndLoadFile(file: File) {
    setBusyMessage(LOADING_MODEL)
    try {
      if (dataRecordId) {
        const uploadedFile = await storageService.upload(appwriteConfig.bucketId, file)
        await databaseService.update<DataRecordRow>('data_records', dataRecordId, {
          modelFileId: uploadedFile.$id,
        })
        setRecord((prev) => (prev ? { ...prev, modelFileId: uploadedFile.$id } : prev))
      }
      loadFile(file)
    } catch (error) {
      console.error(error)
      showToast(SAVE_FAILED, 'error')
    } finally {
      setBusyMessage(null)
    }
  }

  async function handleAddNew() {
    if (isLoadingRecord) return
    if (!record?.modelFileId) {
      inputRef.current?.click()
      return
    }

    if (!isReuseHintDismissed) dismissReuseHint()

    setBusyMessage(LOADING_MODEL)
    try {
      const file = await fetchFolderModelFile({
        file: record.file,
        modelFileId: record.modelFileId,
      })
      loadFile(file)
    } catch (error) {
      console.error(error)
      showToast(LOAD_FAILED, 'error')
    } finally {
      setBusyMessage(null)
    }
  }

  function handleFileSelected(files: FileList | null) {
    if (!files?.length) return
    void registerAndLoadFile(files[0])
  }

  async function handleEdit(id: string, data: Omit<LearningContentFrame, 'id' | 'image'>) {
    await databaseService.update<LearningContentFrameRow>('learning_content_frames', id, data)
    setFrames((prev) => prev.map((frame) => (frame.id === id ? { ...frame, ...data } : frame)))
  }

  async function handleDelete(id: string) {
    await databaseService.remove('learning_content_frames', id)
    setFrames((prev) => prev.filter((frame) => frame.id !== id))
  }

  // The saved capture opens with its picture; the list may not have brought it yet.
  async function handleOpenAnalysis(frame: LearningContentFrame) {
    let viewFrame = frame
    if (!frame.image) {
      setBusyMessage(LOADING_DATA)
      try {
        viewFrame = { ...frame, image: await getFramePicture(frame.id) }
      } catch (error) {
        console.error(error)
        showToast(LOAD_FAILED, 'error')
        return
      } finally {
        setBusyMessage(null)
      }
    }
    navigate('/data/lesion-measurement/analysis', { state: { dataRecordId, viewFrame } })
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="mt-3 flex items-center gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {record?.category ?? DEFAULT_STUDY_NAME}
        </span>
        <div className="relative inline-block">
          <button
            type="button"
            onClick={handleAddNew}
            disabled={isLoadingRecord}
            title="新規追加"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {record?.modelFileId && !isReuseHintDismissed && (
              <GuidanceBubble
                anchor="top-left"
                className="left-10 top-0"
                message="「+」でこのフォルダに新しいキャプチャを追加できます"
                onDismiss={dismissReuseHint}
              />
            )}
          </AnimatePresence>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".fbx,.stl,.obj"
          className="hidden"
          onChange={(event) => {
            handleFileSelected(event.target.files)
            // Without this, picking the same file again fires no change event.
            event.target.value = ''
          }}
        />
      </div>
      {record && (
        <p className="mt-1 text-sm text-gray-400">
          {record.file} ・ {record.date} ・ {record.owner}
        </p>
      )}

      <div className="mt-4">
        <LearningContentTable
          frames={frames}
          isLoading={isLoadingFrames}
          onEdit={handleEdit}
          onOpenAnalysis={handleOpenAnalysis}
          onDelete={handleDelete}
        />
      </div>

      <AnimatePresence>{busyMessage && <LoadingOverlay message={busyMessage} />}</AnimatePresence>

      <AnimatePresence>
        {toast && <Toast message={toast.message} variant={toast.variant} />}
      </AnimatePresence>
    </div>
  )
}
