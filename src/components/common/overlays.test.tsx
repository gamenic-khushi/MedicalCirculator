// @vitest-environment jsdom
import { AnimatePresence, motion } from 'motion/react'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/Toast'
import { reveal } from '@/lib/motion'

// Lets React apply updates inside act() without warnings.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const noop = () => {}
// Each overlay, and whether it is rendered into <body>, outside the page (so a
// page rising in as it opens never moves it) rather than in place.
const OVERLAYS: [string, ReactElement, boolean][] = [
  [
    'Modal',
    <Modal key="o" title="タイトル" onClose={noop}>
      本文
    </Modal>,
    true,
  ],
  [
    'ConfirmDialog',
    <ConfirmDialog key="o" message="本当に削除しますか？" onConfirm={noop} onCancel={noop} />,
    true,
  ],
  ['Toast', <Toast key="o" message="保存しました" />, true],
  ['LoadingOverlay', <LoadingOverlay key="o" message="計測しています..." />, true],
  [
    'GuidanceBubble',
    <GuidanceBubble key="o" anchor="top-left" message="ヒント" onDismiss={noop} />,
    false,
  ],
]

let root: Root | null = null
let container: HTMLElement

function show(overlay: ReactElement, open: boolean) {
  act(() => root!.render(<AnimatePresence>{open && overlay}</AnimatePresence>))
}

// The overlay's outermost element, in <body> or in the page (`container`).
function shown() {
  const outside = [...document.body.children].find((element) => element !== container)
  return (outside ?? container.firstElementChild) as HTMLElement | null
}

// Polls until `check` passes, as the animations run on real frames.
async function eventually(check: () => void, timeoutMs = 2000) {
  const start = Date.now()
  for (;;) {
    try {
      check()
      return
    } catch (error) {
      if (Date.now() - start > timeoutMs) throw error
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    }
  }
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
})

describe.each(OVERLAYS)('%s', (_, overlay, intoBody) => {
  it('ends fully visible after animating in', async () => {
    container = document.body.appendChild(document.createElement('div'))
    root = createRoot(container)
    show(overlay, true)
    const element = shown()!
    expect(element).not.toBeNull()
    expect(container.contains(element)).toBe(!intoBody)
    expect(Number(element.style.opacity)).toBeLessThan(1)
    await eventually(() => expect(element.style.opacity).toBe('1'))
  })

  it('animates out when closed, then leaves the page', async () => {
    container = document.body.appendChild(document.createElement('div'))
    root = createRoot(container)
    show(overlay, true)
    await eventually(() => expect(shown()!.style.opacity).toBe('1'))
    show(overlay, false)
    // Still there while it fades, so the close is seen...
    expect(shown()).not.toBeNull()
    // ...and gone afterwards, so nothing invisible is left covering the page.
    await eventually(() => expect(shown()).toBeNull())
  })
})

// The Shape block's diagram draws in from ① to ② under a clip.
describe('reveal', () => {
  it('ends with nothing clipped, so labels past the edges show in full', async () => {
    container = document.body.appendChild(document.createElement('div'))
    root = createRoot(container)
    act(() => root!.render(<motion.div {...reveal} />))
    const element = container.firstElementChild as HTMLElement
    expect(element.style.clipPath).toContain('inset')
    await eventually(() => {
      expect(element.style.opacity).toBe('1')
      expect(element.style.clipPath).toBe('none')
    })
  })
})
