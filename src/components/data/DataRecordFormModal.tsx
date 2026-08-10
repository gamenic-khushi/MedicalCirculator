import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'

interface DataRecordFormData {
  file: string
  category: string
  owner: string
}

interface DataRecordFormModalProps {
  title: string
  folders: string[]
  initialRecord?: DataRecordFormData
  onClose: () => void
  onSave: (data: DataRecordFormData) => void
}

export function DataRecordFormModal({
  title,
  folders,
  initialRecord,
  onClose,
  onSave,
}: DataRecordFormModalProps) {
  const isEditing = Boolean(initialRecord)
  const [folder, setFolder] = useState(initialRecord?.file ?? folders[0] ?? '')
  const [fileName, setFileName] = useState(initialRecord?.category ?? '')
  const [owner, setOwner] = useState(initialRecord?.owner ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!folder.trim() || !fileName.trim() || !owner.trim()) return
    onSave({ file: folder.trim(), category: fileName.trim(), owner: owner.trim() })
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          フォルダ
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {folders.length === 0 && <option value="">フォルダがありません</option>}
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

        {!isEditing && (
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
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {isEditing ? '保存' : '登録'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
