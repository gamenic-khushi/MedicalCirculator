import { useEffect, useState, type FormEvent } from 'react'

import { FileDropzone } from '@/components/common/FileDropzone'
import { Modal } from '@/components/common/Modal'

import { FolderSelect } from './FolderSelect'

interface DocumentUploadModalProps {
  folders: string[]
  onClose: () => void
  onSave: (data: { folder: string; fileName: string; imageUrl?: string }) => void
}

export function DocumentUploadModal({ folders, onClose, onSave }: DocumentUploadModalProps) {
  const [folder, setFolder] = useState(folders[0] ?? '')
  const [fileName, setFileName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!folder && folders.length > 0) {
      setFolder(folders[0])
    }
  }, [folders, folder])

  function handleFilesSelected(files: FileList) {
    const file = files[0]
    if (!file) return
    if (!fileName) setFileName(file.name)
    if (file.type.startsWith('image/')) setImageUrl(URL.createObjectURL(file))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!fileName.trim()) return
    onSave({ folder, fileName: fileName.trim(), imageUrl: imageUrl ?? undefined })
    onClose()
  }

  return (
    <Modal title="資料登録" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          フォルダ
          <FolderSelect value={folder} folders={folders} onChange={setFolder} />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ファイル名
          <input
            type="text"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        {imageUrl ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
            <img src={imageUrl} alt={fileName} className="h-28 w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              画像を変更する
            </button>
          </div>
        ) : (
          <FileDropzone
            buttonLabel="ブラウズ"
            description="ファイルをアップロード"
            buttonVariant="outline"
            compact
            onFilesSelected={handleFilesSelected}
          />
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  )
}
