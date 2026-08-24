import { Clipboard, Copy, Eye, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface RowActionIconsProps {
  copyText: string
  onView?: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onAdd?: () => void
}

export function RowActionIcons({
  copyText,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onAdd,
}: RowActionIconsProps) {
  const [copied, setCopied] = useState(false)

  function handleCopyLink() {
    void navigator.clipboard?.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative flex items-center justify-end gap-2">
      {copied && (
        <div className="absolute right-0 top-full z-20 mt-2 min-w-[320px] rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900 shadow-lg ring-1 ring-sky-200">
          <div className="flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-sky-600" />
            <span>クリップボードにコピーされました</span>
          </div>
        </div>
      )}
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="rounded p-1 text-amber-500 transition hover:bg-amber-50"
          title="表示"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
        title="編集"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-red-500 transition hover:bg-red-50"
        title="削除"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
        title="複製"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleCopyLink}
        className="rounded p-1 text-blue-500 transition hover:bg-blue-50"
        title="リンクをコピー"
      >
        <Link2 className="h-4 w-4" />
      </button>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded p-1 text-red-500 transition hover:bg-red-50"
          title="追加"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
