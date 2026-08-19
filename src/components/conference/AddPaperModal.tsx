import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Modal } from '@/components/common/Modal'
import type { ConferencePaper } from '@/types/conferencePaper'

const SUCCESS_CLOSE_DELAY_MS = 1500

interface AddPaperModalProps {
  onClose: () => void
  onAdd: (paper: Omit<ConferencePaper, 'id'>) => void
}

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function AddPaperModal({ onClose, onAdd }: AddPaperModalProps) {
  const [journal, setJournal] = useState('')
  const [url, setUrl] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!journal) return
    onAdd({ date: todayIsoDate(), journal, title: '', url: url || undefined })
    setShowSuccess(true)
    setTimeout(onClose, SUCCESS_CLOSE_DELAY_MS)
  }

  return (
    <Modal title="資料登録" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          学会名
          <input
            type="text"
            value={journal}
            onChange={(event) => setJournal(event.target.value)}
            required
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="relative flex flex-col gap-2 text-sm font-medium text-gray-900">
          URL
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {showSuccess && (
            <div className="absolute -top-3 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-md">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                登録完了
              </div>
            </div>
          )}
        </label>

        <div className="mt-2 flex justify-end">
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
