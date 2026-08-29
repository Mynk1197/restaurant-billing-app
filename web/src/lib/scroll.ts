// The app's actual scrollable region is the <main> element in App.tsx
// (the outer page never scrolls), so window.scrollTo has no effect here.
export function scrollContentToTop() {
  document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
}
