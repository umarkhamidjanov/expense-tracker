import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Server-side tests (e.g. the /api route) run in plain Node with no browser window.
const isBrowser = typeof window !== 'undefined'

if (isBrowser) {
  // jsdom lacks these browser APIs.
  // Reporting prefers-reduced-motion makes animated numbers settle instantly.
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })

  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
}

// Charts can't measure a size in jsdom; ignore Recharts' resulting size warning only.
const warn = console.warn
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    if (String(args[0]).includes('of chart should be greater than 0')) return
    warn(...args)
  })
})

afterEach(() => {
  if (!isBrowser) return
  cleanup()
  localStorage.clear()
  window.location.hash = ''
  document.documentElement.removeAttribute('data-theme')
})
