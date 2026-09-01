import { AlertTriangle } from 'lucide-react'
import { useNavigate, useRouteError } from 'react-router-dom'

import { useModel3D } from '@/hooks/useModel3D'

export function ModelViewerErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { setModel } = useModel3D()
  const message = error instanceof Error ? error.message : '不明なエラーが発生しました'

  function handleBack() {
    setModel(null)
    navigate('/3d-analysis')
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-8 lg:px-14">
      <div className="rounded-full bg-red-50 p-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-lg font-semibold text-gray-900">3Dモデルを読み込めませんでした</h1>
      <p className="max-w-md text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={handleBack}
        className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
      >
        3D分析に戻る
      </button>
    </div>
  )
}
