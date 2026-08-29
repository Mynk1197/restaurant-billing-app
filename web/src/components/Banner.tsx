import { useEffect, useRef, type ReactNode } from 'react'

const TONE_CLASSES = {
  success: 'bg-green-50 text-green-700',
  error: 'bg-rose-50 text-rose-600',
} as const

// Only ever rendered while its message is set (callers use `{error && <Banner>}`),
// so it mounts fresh each time a new message appears -- scrolling into view on
// mount brings it on screen wherever it happens to sit on the page, instead of
// jumping the whole page to the top regardless of where the banner actually is.
export default function Banner({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    // 'nearest' skips scrolling if the browser judges the element already
    // partially visible, which came out wrong right after this banner's own
    // mount shifted the page layout. 'start' always aligns it to the top of
    // the scroll area, so it's guaranteed visible regardless of that.
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <p ref={ref} className={`rounded-lg px-3 py-2 text-sm font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </p>
  )
}
