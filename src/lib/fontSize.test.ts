// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { applyFontSize, getFontSize, initFontSize, readFontSize, setFontSize } from './fontSize'

describe('font size setting', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.fontSize = ''
  })

  it('is 中 (16px, the app as it was) when nothing is saved', () => {
    expect(readFontSize()).toBe('medium')
    initFontSize()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('scales the page text for 大 and 小 and remembers the choice', () => {
    setFontSize('large')
    expect(document.documentElement.style.fontSize).toBe('18px')
    expect(getFontSize()).toBe('large')
    expect(readFontSize()).toBe('large')

    setFontSize('small')
    expect(document.documentElement.style.fontSize).toBe('14px')
    expect(readFontSize()).toBe('small')
  })

  it('ignores a saved value it does not know', () => {
    window.localStorage.setItem('font-size', 'huge')
    expect(readFontSize()).toBe('medium')
    applyFontSize(readFontSize())
    expect(document.documentElement.style.fontSize).toBe('16px')
  })
})
