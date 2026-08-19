import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'
import type { DocumentFile } from '@/types/documentFile'

interface DocumentEditModalProps {
  document: DocumentFile
  folders: string[]
  onClose: () => void
  onSave: (data: { folder: string; fileName: string }) => void
}

export function DocumentEditModal({ document, folders, onClose, onSave }: DocumentEditModalProps) {
  const [folder, setFolder] = useState(document.folder ?? '')
  const [fileName, setFileName] = useState(document.fileName)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!fileName.trim()) return
    onSave({ folder, fileName: fileName.trim() })
    onClose()
  }

  return (
    <Modal title="編集" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          フォルダ
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">未選択</option>
            {folders.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  )
}
