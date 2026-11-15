import { useCallback } from 'react'

/**
 * Sizes an element so it ends at the bottom of the window: the space left below
 * its top edge is published as the `--fill-height` CSS variable on the element,
 * for use as a max-height. Content taller than that scrolls inside the element
 * instead of lengthening the page.
 *
 * Returns a ref callback, so it also works for elements that mount later than
 * the component (for example a list that appears once data has loaded).
 * `minHeight` keeps the element usable on short windows, where the page scrolls instead.
 */
export function useFillHeight<T extends HTMLElement>(minHeight = 280, bottomGap = 36) {
  return useCallback(
    (el: T | null) => {
      if (!el) return
      const measure = () => {
        const top = el.getBoundingClientRect().top + window.scrollY
        const height = Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap))
        el.style.setProperty('--fill-height', `${height}px`)
      }
      measure()
      // The element moves when content above it loads or wraps, which resizes the body.
      const observer = new ResizeObserver(measure)
      observer.observe(document.body)
      window.addEventListener('resize', measure)
      return () => {
        observer.disconnect()
        window.removeEventListener('resize', measure)
      }
    },
    [minHeight, bottomGap],
  )
}
