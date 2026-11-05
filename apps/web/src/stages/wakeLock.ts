// The screen stays on while a stage is played (02 §4: Safari 18.4+ has the Screen Wake Lock), taken again when the page
// comes back into view, and let go when the play stops. A phone without it plays on as usual.
import { useEffect } from 'react'

interface WakeLockSentinel {
  release(): Promise<void>
}
type WakeNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } }

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wake = (navigator as WakeNavigator).wakeLock
    if (!active || wake === undefined) return
    let live = true
    let held: WakeLockSentinel | null = null
    const take = () => {
      if (document.visibilityState !== 'visible') return
      wake.request('screen').then((lock) => {
        if (live) held = lock
        else void lock.release().catch(() => {})
      }).catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', take)
      void held?.release().catch(() => {})
    }
  }, [active])
}
