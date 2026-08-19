import { createContext } from 'react'

import type { Model3DFile } from '@/types/model'

export interface Model3DContextValue {
  model: Model3DFile | null
  setModel: (model: Model3DFile | null) => void
}

export const Model3DContext = createContext<Model3DContextValue | undefined>(undefined)
