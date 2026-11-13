// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { useHighlightOnChange } from '@/hooks/useHighlightOnChange'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no Web Animations: count the glows instead.
const glow = vi.fn()
HTMLElement.prototype.animate = glow as unknown as HTMLElement['animate']

function Field({ value }: { value: string }) {
  const ref = useHighlightOnChange<HTMLInputElement>(value)
  return <input ref={ref} value={value} readOnly />
}

describe('useHighlightOnChange', () => {
  it('glows when the value changes, but not when it first shows, is cleared or is being typed', () => {
    const container = document.body.appendChild(document.createElement('div'))
    const root = createRoot(container)
    act(() => root.render(<Field value="1.00" />))
    expect(glow).not.toHaveBeenCalled()

    act(() => root.render(<Field value="2.85" />))
    expect(glow).toHaveBeenCalledOnce()

    act(() => root.render(<Field value="2.85" />))
    act(() => root.render(<Field value="" />))
    expect(glow).toHaveBeenCalledOnce()

    // Whoever is typing in it already knows it changed.
    container.querySelector('input')!.focus()
    act(() => root.render(<Field value="3" />))
    expect(glow).toHaveBeenCalledOnce()
  })
})
