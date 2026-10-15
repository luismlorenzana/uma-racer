// The place's scroll position (D176: "a page opened by a link starts at the top, Back returns to where you were"). The
// place route's own element scrolls, not the window, and React reuses it from one place to the next, so its position
// would carry over; React Router's ScrollRestoration restores only the window's. So: a new path starts at the top; Back
// and Forward return to where that entry was, retried for a few frames while a lazy page fills in, else the top; a
// change of search alone (a Peek, a sheet, a tab) keeps the position. Positions are kept for this page load only.
import { useEffect, useLayoutEffect, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()
/** Frames a restore keeps trying while the page is still too short to reach its position. */
const RESTORE_FRAMES = 30

export function usePlaceScroll(ref: RefObject<HTMLElement | null>): void {
  const location = useLocation()
  const navigation = useNavigationType()

  // The position belongs to the history entry it was read under.
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const key = location.key
    const keep = () => void positions.set(key, element.scrollTop)
    element.addEventListener('scroll', keep, { passive: true })
    return () => element.removeEventListener('scroll', keep)
  }, [ref, location.key])

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const saved = navigation === 'POP' ? positions.get(location.key) : undefined
    element.scrollTop = saved ?? 0
    if (saved === undefined || element.scrollTop >= saved) return
    let frames = 0
    let frame = requestAnimationFrame(function again() {
      element.scrollTop = saved
      frames += 1
      if (element.scrollTop < saved && frames < RESTORE_FRAMES) frame = requestAnimationFrame(again)
    })
    return () => cancelAnimationFrame(frame)
    // Only a new path moves it: a change of search alone keeps the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
}
