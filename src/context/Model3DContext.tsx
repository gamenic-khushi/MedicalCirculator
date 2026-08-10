import { useState, type ReactNode } from 'react'

import type { Model3DFile } from '@/types/model'

import { Model3DContext } from './model3d-context'

export function Model3DProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<Model3DFile | null>(null)

  return <Model3DContext.Provider value={{ model, setModel }}>{children}</Model3DContext.Provider>
}
