import { appwriteConfig } from '@/services/appwrite/config'
import { storageService } from '@/services/appwrite/storage'

import { sniffModelExtension } from './sniffModelFormat'

/**
 * The 3D model stored for a folder, fetched from Storage as a File.
 *
 * record.file is stored metadata, not the actual bytes: if it ever drifts from
 * what modelFileId really points to, trusting its extension picks the wrong
 * loader and fails deep inside a third-party parser. So the bytes are sniffed
 * and the name's extension corrected when they disagree.
 */
export async function fetchFolderModelFile(record: {
  file: string
  modelFileId: string
}): Promise<File> {
  const viewUrl = storageService.getViewUrl(appwriteConfig.bucketId, record.modelFileId)
  const response = await fetch(viewUrl)
  if (!response.ok) throw new Error(`Failed to fetch model file (${response.status})`)
  const buffer = await response.arrayBuffer()
  const sniffedExtension = sniffModelExtension(buffer)
  const fileName =
    sniffedExtension && !record.file.toLowerCase().endsWith(`.${sniffedExtension}`)
      ? `${record.file.replace(/\.[^./]+$/, '')}.${sniffedExtension}`
      : record.file
  return new File([buffer], fileName)
}
