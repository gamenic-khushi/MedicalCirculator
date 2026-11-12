// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Model3DProvider } from '@/context/Model3DContext'
import { ThreeDAnalysisPage } from '@/pages/ThreeDAnalysisPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The file storage and database are outside the app.
const { upload } = vi.hoisted(() => ({ upload: vi.fn(async () => ({ $id: 'f1' })) }))
vi.mock('@/services/appwrite/storage', () => ({ storageService: { upload } }))
vi.mock('@/services/appwrite/database', () => ({
  databaseService: { create: async () => ({ $id: 'r1' }) },
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'admin' } }) }))
URL.createObjectURL = () => 'blob:http://localhost/vessel'

function renderPage() {
  const container = document.createElement('div')
  act(() =>
    createRoot(container).render(
      <Model3DProvider>
        <MemoryRouter>
          <ThreeDAnalysisPage />
        </MemoryRouter>
      </Model3DProvider>,
    ),
  )
  const nameField = container.querySelector<HTMLInputElement>('input[type=text]')!
  const openFolder = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'フォルダを開く',
  )!
  const picker = container.querySelector<HTMLInputElement>('input[type=file]')!
  return { container, nameField, openFolder, picker }
}

const NAME_REQUIRED = '学習名を入力してください'

describe('ThreeDAnalysisPage', () => {
  it('starts with an empty 学習名, with no sample name in it', () => {
    const { nameField } = renderPage()
    expect(nameField.value).toBe('')
    expect(nameField.placeholder).toBe('')
  })

  it('opens no file picker and takes no dropped file until 学習名 is entered', () => {
    const { container, nameField, openFolder, picker } = renderPage()
    const pickerOpened = vi.spyOn(picker, 'click').mockImplementation(() => {})

    act(() => openFolder.click())
    expect(pickerOpened).not.toHaveBeenCalled()
    expect(container.textContent).toContain(NAME_REQUIRED)

    const drop = new Event('drop', { bubbles: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [new File(['solid'], 'vessel.stl')] },
    })
    act(() => openFolder.parentElement!.dispatchEvent(drop))
    expect(upload).not.toHaveBeenCalled()

    // Only spaces is still no name.
    const type = (text: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        nameField,
        text,
      )
      nameField.dispatchEvent(new Event('input', { bubbles: true }))
    }
    act(() => type('   '))
    act(() => openFolder.click())
    expect(pickerOpened).not.toHaveBeenCalled()

    act(() => type('LAD 症例1'))
    expect(container.textContent).not.toContain(NAME_REQUIRED)
    act(() => openFolder.click())
    expect(pickerOpened).toHaveBeenCalledOnce()
  })
})
