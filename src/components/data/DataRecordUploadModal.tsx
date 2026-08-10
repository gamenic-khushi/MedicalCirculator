import { useState, type FormEvent } from 'react'

import { FileDropzone } from '@/components/common/FileDropzone'
import { Modal } from '@/components/common/Modal'

interface DataRecordUploadModalProps {
  onClose: () => void
  onSave: (data: { category: string; file: string; owner: string }) => void
}

export function DataRecordUploadModal({ onClose, onSave }: DataRecordUploadModalProps) {
  const [category, setCategory] = useState('')
  const [file, setFile] = useState('')
  const [owner, setOwner] = useState('')

  function handleFilesSelected(files: FileList) {
    const selected = files[0]
    if (selected && !file) setFile(selected.name)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!category.trim() || !file.trim() || !owner.trim()) return
    onSave({ category: category.trim(), file: file.trim(), owner: owner.trim() })
    onClose()
  }

  return (
    <Modal title="データ登録" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ユーザーカテゴリー
          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          所有者
          <input
            type="text"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ファイル
          <input
            type="text"
            value={file}
            onChange={(event) => setFile(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <FileDropzone
          buttonLabel="ブラウズ"
          description="ファイルをアップロード"
          buttonVariant="outline"
          compact
          onFilesSelected={handleFilesSelected}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            登録
          </button>
        </div>
      </form>
    </Modal>
  )
}
