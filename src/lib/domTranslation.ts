import { getLanguage, subscribeLanguage } from './language'
import { toEnglish } from './translations'

// Shows the app in English when the 言語 setting is English: every Japanese text on the
// page (the words in the page, and the title / placeholder / aria-label / alt of its
// elements) is swapped for its translation (translations.ts), and put back when the
// setting goes back to Japanese. It follows the page as it changes (screens, dialogs,
// toasts), so no screen needs to know about the setting. A text with no translation stays
// Japanese.

const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt']
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE'])
const JAPANESE = /[　-ヿ㐀-鿿＀-￯]/

// What a text node / attribute said before it was translated, and what it was set to.
const textOriginals = new WeakMap<Node, { ja: string; en: string }>()
const attributeOriginals = new WeakMap<Element, Map<string, { ja: string; en: string }>>()

function translateTextNode(node: Text): void {
  const value = node.nodeValue ?? ''
  const known = textOriginals.get(node)
  // Our own English is left as it is; anything else is new text from the page.
  if (known && known.en === value) return
  if (!JAPANESE.test(value)) return
  const english = toEnglish(value)
  if (english === null) {
    textOriginals.delete(node)
    return
  }
  textOriginals.set(node, { ja: value, en: english })
  node.nodeValue = english
}

function translateAttributes(element: Element): void {
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name)
    if (value === null) continue
    const known = attributeOriginals.get(element)?.get(name)
    if (known && known.en === value) continue
    if (!JAPANESE.test(value)) continue
    const english = toEnglish(value)
    if (english === null) continue
    let map = attributeOriginals.get(element)
    if (!map) {
      map = new Map()
      attributeOriginals.set(element, map)
    }
    map.set(name, { ja: value, en: english })
    element.setAttribute(name, english)
  }
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!SKIPPED.has((root.parentElement ?? { tagName: '' }).tagName)) translateTextNode(root as Text)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!SKIPPED.has((node.parentElement ?? { tagName: '' }).tagName)) translateTextNode(node as Text)
    } else {
      translateAttributes(node as Element)
    }
    node = walker.nextNode()
  }
}

// Back to the Japanese the page had.
function restoreTree(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.currentNode
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const known = textOriginals.get(node)
      if (known && node.nodeValue === known.en) node.nodeValue = known.ja
      textOriginals.delete(node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const map = attributeOriginals.get(node as Element)
      if (map) {
        for (const [name, known] of map) {
          if ((node as Element).getAttribute(name) === known.en) (node as Element).setAttribute(name, known.ja)
        }
        attributeOriginals.delete(node as Element)
      }
    }
    node = walker.nextNode()
  }
}

/** Start following the page and the 言語 setting; returns a function that stops it. */
export function startDomTranslation(): () => void {
  const observer = new MutationObserver((records) => {
    if (getLanguage() !== 'en') return
    // Our own changes must not come back as new ones.
    observer.disconnect()
    try {
      for (const record of records) {
        if (record.type === 'childList') {
          record.addedNodes.forEach((added) => translateTree(added))
        } else if (record.type === 'characterData') {
          translateTree(record.target)
        } else if (record.type === 'attributes') {
          translateAttributes(record.target as Element)
        }
      }
    } finally {
      observe()
    }
  })

  function observe() {
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    })
  }

  function apply() {
    observer.disconnect()
    try {
      if (getLanguage() === 'en') translateTree(document.body)
      else restoreTree(document.body)
    } finally {
      observe()
    }
  }

  observe()
  apply()
  const unsubscribe = subscribeLanguage(apply)
  return () => {
    unsubscribe()
    observer.disconnect()
  }
}
