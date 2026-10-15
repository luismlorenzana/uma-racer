// Reduced motion for the new game (docs/rework/11-hub-and-places.md §12; ux "Accessibility and comfort"): on when the
// system asks for it or Account's device switch is set (`uma-racer:g2:reducedMotion`, T138). The root applies it through
// Motion's `MotionConfig` and a `data-reduced-motion` attribute for CSS: no pip bounce, no number transition, instant
// sheets. The shell runs under `LazyMotion strict`, so only `m.*` components draw.
import { LazyMotion, MotionConfig } from 'motion/react'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

export const REDUCED_MOTION_KEY = 'uma-racer:g2:reducedMotion'
const CHANGED = 'uma-racer:g2:reduced-motion-changed'
const QUERY = '(prefers-reduced-motion: reduce)'

const loadMotionFeatures = () => import('../../ui/motionFeatures').then((mod) => mod.default)

function deviceSwitch(): boolean {
  try {
    const value = globalThis.localStorage?.getItem(REDUCED_MOTION_KEY)
    return value === 'true' || value === '1'
  } catch {
    return false
  }
}

/** Account's device switch (T138): stored per device, never synced (02 §10). */
export function setDeviceReducedMotion(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(REDUCED_MOTION_KEY, 'true')
    else globalThis.localStorage?.removeItem(REDUCED_MOTION_KEY)
  } catch {
    // The system setting still applies.
  }
  globalThis.dispatchEvent?.(new Event(CHANGED))
}

const media = (): MediaQueryList | null => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null)

function subscribe(listener: () => void): () => void {
  const query = media()
  query?.addEventListener('change', listener)
  globalThis.addEventListener?.(CHANGED, listener)
  globalThis.addEventListener?.('storage', listener)
  return () => {
    query?.removeEventListener('change', listener)
    globalThis.removeEventListener?.(CHANGED, listener)
    globalThis.removeEventListener?.('storage', listener)
  }
}

const reducedNow = (): boolean => (media()?.matches ?? false) || deviceSwitch()

export function useReducedMotionSetting(): boolean {
  return useSyncExternalStore(subscribe, reducedNow, () => false)
}

/** The new game's motion root: lazy features, strict `m.*`, and the reduced-motion setting for Motion and CSS. */
export function MotionRoot({ children, features }: { children: ReactNode; features?: Parameters<typeof LazyMotion>[0]['features'] }) {
  const reduced = useReducedMotionSetting()
  useEffect(() => {
    const root = document.documentElement
    if (reduced) root.setAttribute('data-reduced-motion', '')
    else root.removeAttribute('data-reduced-motion')
    return () => root.removeAttribute('data-reduced-motion')
  }, [reduced])
  return (
    <LazyMotion features={features ?? loadMotionFeatures} strict>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </LazyMotion>
  )
}
