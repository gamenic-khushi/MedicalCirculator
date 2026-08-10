import { Info } from 'lucide-react'

import type { Model3DFile } from '@/types/model'

const LABELS: Record<string, string> = {
  fileName: 'ファイル名',
  fileType: 'ファイルの種類',
  size: 'サイズ',
  uploadDate: 'アップロード日',
}

export function ModelInfoCard({ model }: { model: Model3DFile }) {
  const rows = [
    { label: LABELS.fileName, value: model.file.name },
    { label: LABELS.fileType, value: model.fileType },
    { label: LABELS.size, value: model.sizeLabel },
    { label: LABELS.uploadDate, value: model.uploadDate },
  ]

  return (
    <div className="flex-1 border-t border-gray-100 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Info className="h-4 w-4 text-blue-500" />
        モデル情報
      </div>

      <dl className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <dt className="text-gray-500">{row.label}</dt>
            <dd className="truncate pl-2 font-medium text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
