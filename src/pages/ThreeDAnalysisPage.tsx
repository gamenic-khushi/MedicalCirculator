import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { pickModelFile } from '@/lib/filePickerMemory'
import { useModel3D } from '@/hooks/useModel3D'
import { createModel3DFile } from '@/types/model'

const DEFAULT_FOLDER = '２D心弁解析'
const DEFAULT_STUDY_NAME = '２D心弁解析'

interface ThreeDAnalysisPageProps {
  viewerPath?: string
}

export function ThreeDAnalysisPage({ viewerPath = '/3d-analysis/viewer' }: ThreeDAnalysisPageProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { model, setModel } = useModel3D()
  const [studyName, setStudyName] = useState('')

  useEffect(() => {
    if (model) navigate(viewerPath, { replace: true })
  }, [model, navigate, viewerPath])

  function loadFile(file: File) {
    setModel(
      createModel3DFile(file, {
        folder: DEFAULT_FOLDER,
        studyName: studyName.trim() || DEFAULT_STUDY_NAME,
      }),
    )
    navigate(viewerPath)
  }

  function handleFileSelected(files: FileList | null) {
    if (!files?.length) return
    loadFile(files[0])
  }

  async function handleOpenFolder() {
    const file = await pickModelFile(() => inputRef.current?.click())
    if (file) loadFile(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    handleFileSelected(event.dataTransfer.files)
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">3D分析</h1>
      <div className="mt-4 border-b border-gray-200" />

      <div className="mt-6 flex max-w-md flex-col gap-3">
        <label className="flex items-center gap-4 text-sm text-gray-700">
          <span className="w-16 shrink-0 font-medium">学習名</span>
          <input
            type="text"
            value={studyName}
            onChange={(event) => setStudyName(event.target.value)}
            placeholder={DEFAULT_STUDY_NAME}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 py-14 shadow-sm"
      >
        <button
          type="button"
          onClick={handleOpenFolder}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
        >
          フォルダを開く
        </button>
        <p className="text-sm text-gray-600">ファイルをアップロード</p>
        <p className="text-xs text-gray-400">.fbx, .stl, .obj</p>
        <input
          ref={inputRef}
          type="file"
          accept=".fbx,.stl,.obj"
          className="hidden"
          onChange={(event) => handleFileSelected(event.target.files)}
        />
      </div>
    </div>
  )
}
