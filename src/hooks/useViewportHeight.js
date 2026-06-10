import { useState, useLayoutEffect } from 'react'

function getViewportHeight() {
  if (typeof window === 'undefined') return null
  return Math.round(window.visualViewport?.height || window.innerHeight)
}

// Tracks the real visible viewport height (keyboard, browser chrome, rotation)
// so the app shell can size itself to exactly the visible area.
export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight())

  useLayoutEffect(() => {
    let rafId = null

    const syncViewportHeight = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(() => {
        setViewportHeight(getViewportHeight())
      })
    }

    syncViewportHeight()

    window.addEventListener('resize', syncViewportHeight)
    window.addEventListener('orientationchange', syncViewportHeight)
    window.addEventListener('pageshow', syncViewportHeight)
    document.addEventListener('visibilitychange', syncViewportHeight)
    window.visualViewport?.addEventListener('resize', syncViewportHeight)
    window.visualViewport?.addEventListener('scroll', syncViewportHeight)

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', syncViewportHeight)
      window.removeEventListener('orientationchange', syncViewportHeight)
      window.removeEventListener('pageshow', syncViewportHeight)
      document.removeEventListener('visibilitychange', syncViewportHeight)
      window.visualViewport?.removeEventListener('resize', syncViewportHeight)
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight)
    }
  }, [])

  return viewportHeight
}
