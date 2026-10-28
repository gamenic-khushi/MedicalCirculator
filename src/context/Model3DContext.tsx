import { useEffect, useState, type ReactNode } from 'react'

import { releaseModelAssets } from '@/components/model-viewer/Model3D'
import type { Model3DFile } from '@/types/model'

import { Model3DContext } from './model3d-context'

export function Model3DProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<Model3DFile | null>(null)

  // Runs once the model has been replaced or removed (and its viewer has
  // unmounted): free what was loaded from it and the blob URL holding the
  // uploaded file's bytes, which otherwise stay in memory until the tab closes.
  useEffect(() => {
    if (!model) return
    return () => {
      releaseModelAssets(model.objectUrl)
      URL.revokeObjectURL(model.objectUrl)
    }
  }, [model])

  return <Model3DContext.Provider value={{ model, setModel }}>{children}</Model3DContext.Provider>
}
