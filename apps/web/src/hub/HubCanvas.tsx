// Hosts the lazy Phaser Hub map (docs/game/11-hub-and-places.md §1, §12; ported from uma-rpg's `hub/HubCanvas.tsx`):
// created on mount, destroyed on unmount, paused while an overlay, sheet or menu covers it or the page is hidden. The
// canvas only draws; every tap goes to the DOM above it. Without a ResizeObserver (jsdom) no engine starts and the map
// stays its background colour, which the DOM place buttons don't need.
import type { HubPage, PlaceAt } from '@racer/domain/hub'
import { useEffect, useRef } from 'react'
import type { HubGame } from './scene/createHubGame'
import type { HubScenePlace } from './scene/HubScene'
import { PALETTES } from './scene/palettes'

export interface HubCanvasProps {
  readonly page: HubPage
  readonly places: readonly HubScenePlace[]
  readonly clearings: readonly PlaceAt[]
  readonly paused: boolean
  readonly reducedMotion: boolean
}

export function HubCanvas({ page, places, clearings, paused, reducedMotion }: HubCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const game = useRef<HubGame | null>(null)
  const latest = useRef({ page, places, clearings, reducedMotion })
  latest.current = { page, places, clearings, reducedMotion }
  const pausedNow = useRef(paused)
  pausedNow.current = paused

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    let cancelled = false
    void import('./scene/createHubGame').then(async ({ createHubGame }) => {
      if (cancelled || !host.current) return
      const created = await createHubGame(host.current, latest.current)
      if (cancelled) {
        created.destroy()
        return
      }
      game.current = created
      created.setPaused(pausedNow.current || document.hidden)
    })
    return () => {
      cancelled = true
      game.current?.destroy()
      game.current = null
    }
  }, [])

  useEffect(() => {
    game.current?.update({ page, places, clearings, reducedMotion })
  }, [page, places, clearings, reducedMotion])

  useEffect(() => {
    const apply = () => game.current?.setPaused(paused || document.hidden)
    apply()
    document.addEventListener('visibilitychange', apply)
    return () => document.removeEventListener('visibilitychange', apply)
  }, [paused])

  return (
    <div
      ref={host}
      data-g2="hub-canvas"
      data-paused={paused || undefined}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: PALETTES[page].background }}
    />
  )
}
