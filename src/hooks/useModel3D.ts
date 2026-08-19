import { useContext } from 'react'

import { Model3DContext } from '@/context/model3d-context'

export function useModel3D() {
  const context = useContext(Model3DContext)

  if (!context) {
    throw new Error('useModel3D must be used within a Model3DProvider')
  }

  return context
}
