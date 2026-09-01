import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'

interface DocumentNameModalProps {
  title: string
  fieldLabel?: string
  initialName?: string
  onClose: () => void
  onSubmit: (fileName: string) => void
}

export function DocumentNameModal({
  title,
  fieldLabel = 'ファイル名',
  initialName = '',
  onClose,
  onSubmit,
}: DocumentNameModalProps) {
  const [name, setName] = useState(initialName)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim())
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          {fieldLabel}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            {initialName ? '保存' : '登録'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
