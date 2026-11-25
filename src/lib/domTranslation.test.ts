// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { startDomTranslation } from './domTranslation'
import { setLanguage } from './language'

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('the page in English', () => {
  let stop: () => void

  beforeEach(() => {
    window.localStorage.clear()
    setLanguage('ja')
    document.body.innerHTML =
      '<h1>3D解析</h1><button title="保存">保存</button><input placeholder="検索"><p>テスト用の学習 A</p>'
    stop = startDomTranslation()
  })

  afterEach(() => {
    stop()
    setLanguage('ja')
  })

  it('shows English for the texts it knows, and puts the Japanese back', () => {
    setLanguage('en')
    expect(document.querySelector('h1')?.textContent).toBe('3D Analysis')
    expect(document.querySelector('button')?.textContent).toBe('Save')
    expect(document.querySelector('button')?.getAttribute('title')).toBe('Save')
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('Search')
    // The user's own data is not translated.
    expect(document.querySelector('p')?.textContent).toBe('テスト用の学習 A')

    setLanguage('ja')
    expect(document.querySelector('h1')?.textContent).toBe('3D解析')
    expect(document.querySelector('button')?.getAttribute('title')).toBe('保存')
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('検索')
  })

  it('follows the page: new elements and changed texts are translated too', async () => {
    setLanguage('en')
    const added = document.createElement('span')
    added.textContent = '血圧'
    document.body.appendChild(added)
    await settle()
    expect(added.textContent).toBe('Blood Pressure')

    // The page changes a text it had put there: the new text is translated, not left Japanese.
    document.querySelector('h1')!.firstChild!.nodeValue = '資料'
    await settle()
    expect(document.querySelector('h1')?.textContent).toBe('Documents')

    setLanguage('ja')
    expect(added.textContent).toBe('血圧')
  })
})
