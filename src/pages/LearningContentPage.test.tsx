// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Model3DProvider } from '@/context/Model3DContext'
import { useModel3D } from '@/hooks/useModel3D'
import { LearningContentPage } from '@/pages/LearningContentPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The database and file storage are outside the app: a record renamed on the
// lesion page to 'Renamed-B', with its model file already stored.
vi.mock('@/services/appwrite/database', () => ({
  databaseService: {
    get: async () => ({
      $id: 'r1',
      date: '2026/11/11',
      category: 'Renamed-B',
      file: 'vessel.stl',
      owner: 'admin',
      modelFileId: 'm1',
    }),
    list: async () => ({ rows: [], total: 0 }),
  },
}))
vi.mock('@/services/appwrite/storage', () => ({
  storageService: { getViewUrl: () => 'https://storage.test/m1' },
}))
vi.stubGlobal('fetch', async () => new Response('solid vessel\nendsolid vessel\n'))
URL.createObjectURL = () => 'blob:http://localhost/vessel'
URL.revokeObjectURL = () => {}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('LearningContentPage', () => {
  it('opens a record under its saved name, not the default one', async () => {
    let studyName: string | undefined
    function Probe() {
      studyName = useModel3D().model?.studyName
      return null
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        <Model3DProvider>
          <MemoryRouter initialEntries={[{ pathname: '/data/learning-content', state: { dataRecordId: 'r1' } }]}>
            <LearningContentPage />
          </MemoryRouter>
          <Probe />
        </Model3DProvider>,
      ),
    )
    await settle()

    const plus = [...container.querySelectorAll('button')].find((button) => button.querySelector('svg.lucide-plus'))
    act(() => plus?.click())
    await settle()
    await settle()

    expect(studyName).toBe('Renamed-B')
    act(() => root.unmount())
  })
})
