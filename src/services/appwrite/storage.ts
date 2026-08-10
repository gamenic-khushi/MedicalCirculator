import { ID } from 'appwrite'

import { storage } from './client'

export const storageService = {
  async upload(bucketId: string, file: File) {
    return storage.createFile(bucketId, ID.unique(), file)
  },

  async remove(bucketId: string, fileId: string) {
    return storage.deleteFile(bucketId, fileId)
  },

  getPreviewUrl(bucketId: string, fileId: string) {
    return storage.getFilePreview(bucketId, fileId)
  },

  getViewUrl(bucketId: string, fileId: string) {
    return storage.getFileView(bucketId, fileId)
  },
}
