// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Model3DProvider } from '@/context/Model3DContext'
import { useModel3D } from '@/hooks/useModel3D'
import type { Model3DFile } from '@/types/model'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const uploaded: Model3DFile = {
  file: new File(['solid'], 'vessel.stl'),
  objectUrl: 'blob:http://localhost/vessel',
  extension: 'stl',
  fileType: 'STL',
  sizeLabel: '0.0 MB',
  uploadDate: '2026/11/11',
  folder: 'f',
  studyName: '2D心弁解析',
}

// Renders the provider and hands back its setModel.
function renderProvider() {
  let setModel: ((model: Model3DFile | null) => void) | undefined
  function Grab() {
    setModel = useModel3D().setModel
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Model3DProvider><Grab /></Model3DProvider>))
  return { setModel: (model: Model3DFile | null) => act(() => setModel?.(model)), root }
}

describe('Model3DProvider', () => {
  const revoke = vi.fn()
  URL.revokeObjectURL = revoke
  afterEach(() => revoke.mockClear())

  it('keeps the file alive when only the study name changes (renaming the title)', () => {
    const { setModel, root } = renderProvider()
    setModel(uploaded)
    setModel({ ...uploaded, studyName: '新しい名前' })
    expect(revoke).not.toHaveBeenCalled()
    act(() => root.unmount())
  })

  it('frees the file once the model is removed', () => {
    const { setModel, root } = renderProvider()
    setModel(uploaded)
    setModel(null)
    expect(revoke).toHaveBeenCalledWith(uploaded.objectUrl)
    act(() => root.unmount())
  })
})
