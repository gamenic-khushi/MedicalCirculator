import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { pickModelFile } from '@/lib/filePickerMemory'
import { useModel3D } from '@/hooks/useModel3D'
import { createModel3DFile } from '@/types/model'

export function ThreeDAnalysisPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { model, setModel } = useModel3D()

  useEffect(() => {
    if (model) navigate('/3d-analysis/viewer', { replace: true })
  }, [model, navigate])

  function loadFile(file: File) {
    setModel(createModel3DFile(file))
    navigate('/3d-analysis/viewer')
  }

  function handleFileSelected(files: FileList | null) {
    if (!files?.length) return
    loadFile(files[0])
  }

  async function handleOpenFolder() {
    const file = await pickModelFile(() => inputRef.current?.click())
    if (file) loadFile(file)
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">3D 分析</h1>

      <div className="mt-4 border-b border-gray-200" />

      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 py-14 shadow-sm">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
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
