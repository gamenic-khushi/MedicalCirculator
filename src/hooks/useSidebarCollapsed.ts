import { useCallback, useState } from 'react'

// Whether the left-hand menu is collapsed to its icons (Aki, 2026/11/25). The choice is
// remembered in this browser; a blocked localStorage only means it does not stick.
const KEY = 'sidebar-collapsed'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read)
  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        // Not remembered; nothing else to do.
      }
      return next
    })
  }, [])
  return { collapsed, toggle }
}
