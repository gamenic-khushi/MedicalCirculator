import { useEffect, useState, type ReactNode } from 'react'

import { releaseModelAssets } from '@/components/model-viewer/Model3D'
import type { Model3DFile } from '@/types/model'

import { Model3DContext } from './model3d-context'

export function Model3DProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<Model3DFile | null>(null)

  // Runs once the file has been replaced or removed (and its viewer has
  // unmounted): free what was loaded from it and the blob URL holding the
  // uploaded file's bytes, which otherwise stay in memory until the tab closes.
  // Keyed on the URL, not the model: renaming the study keeps the same file,
  // and freeing it then broke the viewer ("Could not load blob…").
  const objectUrl = model?.objectUrl
  useEffect(() => {
    if (!objectUrl) return
    return () => {
      releaseModelAssets(objectUrl)
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  return <Model3DContext.Provider value={{ model, setModel }}>{children}</Model3DContext.Provider>
}
