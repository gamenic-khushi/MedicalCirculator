import type { Models } from 'appwrite'
import { Plus, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Toast } from '@/components/common/Toast'
import { DocumentFileTable } from '@/components/documents/DocumentFileTable'
import { DocumentNameModal } from '@/components/documents/DocumentNameModal'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { databaseService } from '@/services/appwrite/database'
import type { DocumentFile } from '@/types/documentFile'

const TOAST_DURATION_MS = 1800

type DocumentRow = Models.Row & Omit<DocumentFile, 'id'>

function todayDisplayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}/${month}/${day}`
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentFile[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    databaseService.list<DocumentRow>('documents').then(({ rows }) => {
      const loaded = rows.map(({ $id, ...rest }) => ({ id: $id, ...rest }))
      setDocuments(loaded)
      setFolders((prev) => {
        const loadedFolders = loaded.map((document) => document.folder).filter(Boolean)
        return Array.from(new Set([...prev, ...loadedFolders])) as string[]
      })
    })
  }, [])

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return documents
    return documents.filter((document) => document.fileName.toLowerCase().includes(normalized))
  }, [documents, query])

  function handleAddFolder(folderName: string) {
    setFolders((prev) => [...prev, folderName])
    setToastMessage('登録完了')
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  async function handleEdit(id: string, data: { folder: string; fileName: string }) {
    await databaseService.update<DocumentRow>('documents', id, data)
    setDocuments((prev) =>
      prev.map((document) => (document.id === id ? { ...document, ...data } : document)),
    )
  }

  async function handleDelete(id: string) {
    await databaseService.remove('documents', id)
    setDocuments((prev) => prev.filter((document) => document.id !== id))
  }

  async function handleDuplicate(document: DocumentFile) {
    const row = await databaseService.create<DocumentRow>('documents', {
      date: todayDisplayDate(),
      fileName: document.fileName,
      folder: document.folder,
      imageUrl: document.imageUrl,
    })
    const { $id, ...rest } = row
    setDocuments((prev) => {
      const index = prev.findIndex((item) => item.id === document.id)
      const next = [...prev]
      next.splice(index + 1, 0, { id: $id, ...rest })
      return next
    })
  }

  async function handleSaveUpload({
    folder,
    fileName,
    imageUrl,
  }: {
    folder: string
    fileName: string
    imageUrl?: string
  }) {
    const row = await databaseService.create<DocumentRow>('documents', {
      date: todayDisplayDate(),
      fileName,
      folder,
      imageUrl,
    })
    const { $id, ...rest } = row
    setDocuments((prev) => [{ id: $id, ...rest }, ...prev])
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">資料</h1>
          <button
            type="button"
            onClick={() => setIsAddingFolder(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700"
            title="フォルダを追加"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsUploading(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4" />
            ファイルのアップロード
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="検索"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="mt-6">
        <DocumentFileTable
          documents={filteredDocuments}
          folders={folders}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      </div>

      {isAddingFolder && (
        <DocumentNameModal
          title="資料登録"
          fieldLabel="フォルダ名"
          onClose={() => setIsAddingFolder(false)}
          onSubmit={handleAddFolder}
        />
      )}

      {isUploading && (
        <DocumentUploadModal
          folders={folders}
          onClose={() => setIsUploading(false)}
          onSave={handleSaveUpload}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
