// Cues are already decided and journalled. Playback never advances the engine (docs/design/uma-rpg.md).
import type { CombatCue } from '@racer/domain'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useBattlePlayback(reducedMotion: boolean) {
  const [cue, setCue] = useState<CombatCue | null>(null)
  const [playing, setPlaying] = useState(false)
  const finishRef = useRef<(() => void) | null>(null)
  const frameRef = useRef<number | null>(null)
  const skip = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    setCue(null); setPlaying(false)
    finishRef.current?.(); finishRef.current = null
  }, [])
  const play = useCallback((cues: CombatCue[]) => {
    skip()
    if (reducedMotion || cues.length === 0 || document.hidden) return Promise.resolve()
    setPlaying(true); setCue(cues[0]!)
    return new Promise<void>((resolve) => {
      finishRef.current = resolve
      let elapsed = 0, previous: number | null = null, index = 0
      const tick = (now: number) => {
        // Delta time, not a frame-count assumption; one cue has the same duration at 60/120 Hz.
        if (previous !== null) elapsed += Math.max(0, now - previous)
        previous = now
        while (elapsed >= 280) {
          elapsed -= 280; index++
          if (index >= cues.length) { skip(); return }
          setCue(cues[index]!)
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    })
  }, [reducedMotion, skip])
  useEffect(() => {
    const background = () => { if (document.hidden) skip() }
    document.addEventListener('visibilitychange', background)
    window.addEventListener('orientationchange', skip)
    return () => { document.removeEventListener('visibilitychange', background); window.removeEventListener('orientationchange', skip); skip() }
  }, [skip])
  useEffect(() => { if (reducedMotion) skip() }, [reducedMotion, skip])
  return { cue, playing, play, skip }
}
