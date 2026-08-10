import { useContext } from 'react'

import { ViewerStateContext } from '@/context/viewer-state-context'

export function useViewerState() {
  const context = useContext(ViewerStateContext)

  if (!context) {
    throw new Error('useViewerState must be used within a ViewerStateProvider')
  }

  return context
}
