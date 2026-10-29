import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

async function fetchLatestBuildId(): Promise<string | null> {
  try {
    // no-store, plus a changing query, so this always reaches the server even
    // when the page itself came from the browser's cache.
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    const data: unknown = await response.json()
    const id = (data as { id?: unknown } | null)?.id
    return typeof id === 'string' ? id : null
  } catch {
    // Offline, or the SPA fallback answered with index.html: nothing to compare.
    return null
  }
}

/**
 * The id of a deployment newer than the one running in this tab, or null.
 * Checked at load, when the tab becomes visible again and every few minutes,
 * so users learn about an update without having to clear their browser cache.
 */
export function useUpdateAvailable(): string | null {
  const [latestId, setLatestId] = useState<string | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    let cancelled = false
    async function check() {
      const id = await fetchLatestBuildId()
      if (!cancelled && id && id !== __APP_BUILD_ID__) setLatestId(id)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void check()
    }

    void check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return latestId
}
