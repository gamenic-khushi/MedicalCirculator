import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { getFramePicture } from '@/lib/frameImages'

interface FrameImageProps {
  frameId: string
  // The picture if the row came with it; otherwise it is fetched when it is on screen.
  image?: string
  alt: string
  // The box (size, rounding, background); the picture fills it.
  className?: string
  style?: CSSProperties
  imageClassName?: string
  // Fetch at once instead of when scrolled into view (for a picture already open).
  eager?: boolean
}

// A saved capture's picture. A list does not carry the pictures, so each one shows a
// spinner in its box until it arrives, then fades in; the row itself is already there.
export function FrameImage({
  frameId,
  image,
  alt,
  className = '',
  style,
  imageClassName = 'h-full w-full object-contain',
  eager = false,
}: FrameImageProps) {
  const [fetched, setFetched] = useState<{ id: string; src: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const src = image || (fetched?.id === frameId ? fetched.src : '')

  useEffect(() => {
    if (src) return
    let cancelled = false
    const load = () =>
      getFramePicture(frameId)
        .then((picture) => {
          if (cancelled) return
          if (picture) setFetched({ id: frameId, src: picture })
          else setFailed(true)
        })
        .catch((error) => {
          console.error(error)
          if (!cancelled) setFailed(true)
        })
    const element = box.current
    if (eager || !element || typeof IntersectionObserver === 'undefined') {
      void load()
      return () => {
        cancelled = true
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void load()
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [frameId, src, eager])

  return (
    <div ref={box} className={`relative overflow-hidden ${className}`} style={style}>
      {src ? (
        <img src={src} alt={alt} decoding="async" className={imageClassName} />
      ) : failed ? (
        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">—</div>
      ) : (
        <div
          role="status"
          aria-label="画像を読み込んでいます"
          className="flex h-full w-full animate-pulse items-center justify-center bg-white/10"
        >
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400/50 border-t-indigo-500"
          />
        </div>
      )}
    </div>
  )
}
