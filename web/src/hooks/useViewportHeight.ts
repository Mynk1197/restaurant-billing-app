import { useEffect } from 'react'

// iOS Safari has a long-standing WebKit bug where 100dvh doesn't reliably
// resolve to the actual visible height inside an installed (home-screen
// launched) PWA -- it can under-report, leaving a blank gap between the
// app's content and the real bottom of the screen. Setting the real pixel
// height via JS (window.innerHeight, which iOS gets right) into a CSS
// variable sidesteps the unit entirely instead of trying to out-guess it.
export function useViewportHeight() {
  useEffect(() => {
    function setHeight() {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
    }
    setHeight()
    window.addEventListener('resize', setHeight)
    window.addEventListener('orientationchange', setHeight)
    return () => {
      window.removeEventListener('resize', setHeight)
      window.removeEventListener('orientationchange', setHeight)
    }
  }, [])
}
