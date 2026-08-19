import { Modal } from '@/components/common/Modal'
import type { DocumentFile } from '@/types/documentFile'

export function DocumentPreviewModal({
  document,
  onClose,
}: {
  document: DocumentFile
  onClose: () => void
}) {
  return (
    <Modal title="ビュー" onClose={onClose}>
      <div className="flex flex-col gap-6">
        {document.imageUrl && (
          <img
            src={document.imageUrl}
            alt={document.fileName}
            className="h-48 w-full rounded-xl object-cover"
          />
        )}

        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          フォルダ
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900">
            {document.folder || '-'}
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          ファイル名
          <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-900">
            {document.fileName}
          </div>
        </div>
      </div>
    </Modal>
  )
}
