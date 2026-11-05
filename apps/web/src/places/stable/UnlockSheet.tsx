// Unlocking an Uma (docs/game/02-unlocks.md §2; D386): one sheet, one screen. Her bust, aptitudes and growth rates, the
// Uma Tickets going N to N−1, and **Unlock · 1 Uma Ticket**, which commits `unlock-uma`. A short reveal follows in the
// same sheet: her bust grows in (transform and opacity only) under "{name} joins your Stable", with **Her profile**
// preselected and Done. A refusal shows in plain words and changes nothing.
import { UmaBust } from '@luismlorenzana/uma-kit/album'
import { Button, Sheet, UiMark } from '@luismlorenzana/uma-kit/ui'
import type { UmaTemplate } from '@racer/domain'
import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGame, useRun } from '../../app/game'
import { profilePath } from '../../hub/nav'
import { AptitudeGrid, GrowthRow } from '../../ui/BuildFacts'
import { stableWords } from './model'

type Phase = 'ask' | 'busy' | 'done'

function Facts({ uma }: { uma: UmaTemplate }) {
  return (
    <div className="space-y-3">
      <section className="space-y-1.5">
        <h3 className="text-micro">{stableWords('aptitudes')}</h3>
        <AptitudeGrid aptitudes={uma.aptitudes} />
      </section>
      <section className="space-y-1.5">
        <h3 className="text-micro">{stableWords('growth')}</h3>
        <GrowthRow growth={uma.growthRates} />
      </section>
    </div>
  )
}

/**
 * The unlock sheet for `umaId`, open while it is set; `onClose` clears it. **Her profile** opens her profile, or calls
 * `onProfile` where the sheet already sits on it.
 */
export function UnlockSheet({ umaId, onClose, onProfile }: { umaId: string | null; onClose: () => void; onProfile?: () => void }) {
  const run = useRun()
  const navigate = useNavigate()
  const tickets = useGame((snapshot) => snapshot.state?.account.umaTickets ?? 0)
  const umas = useGame((snapshot) => snapshot.env?.content.umas ?? null)
  // The sheet keeps its Uma while it slides away.
  const [shown, setShown] = useState<string | null>(umaId)
  const [phase, setPhase] = useState<Phase>('ask')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (umaId === null) return
    setShown(umaId)
    setPhase('ask')
    setError(null)
  }, [umaId])

  const uma = shown === null ? undefined : umas?.get(shown)
  const name = uma?.name ?? shown ?? ''

  const unlock = async () => {
    if (shown === null) return
    setPhase('busy')
    setError(null)
    try {
      const answer = await run('unlock-uma', { umaId: shown }, `unlock-uma:${shown}`)
      if (answer.kind === 'done') setPhase('done')
      else {
        setError(answer.text)
        setPhase('ask')
      }
    } catch {
      setError(stableWords('failed'))
      setPhase('ask')
    }
  }

  const done = phase === 'done'
  const mark = <UiMark mark="currency/uma-ticket" />
  const footer = done ? (
    <div className="flex gap-2">
      <Button variant="secondary" className="flex-1" onClick={onClose}>{stableWords('done')}</Button>
      <Button className="flex-[2]" onClick={() => (onProfile !== undefined ? onProfile() : shown !== null && navigate(profilePath(shown), { state: { back: true } }))}>
        {stableWords('profile')}
      </Button>
    </div>
  ) : (
    <Button className="w-full" disabled={tickets < 1 || phase === 'busy' || uma === undefined} onClick={() => void unlock()}
      aria-label={`${stableWords('unlock')}: ${name}`}>
      <span className="flex items-center justify-center gap-1.5">{mark}{stableWords('unlock')}</span>
    </Button>
  )

  return (
    <Sheet
      open={umaId !== null}
      onClose={onClose}
      title={done ? stableWords('welcome', { name }) : stableWords('unlock-title', { name })}
      footer={footer}
    >
      {uma === undefined ? (
        <p className="text-[14px] text-ink-soft">{stableWords('unknown-uma')}</p>
      ) : done ? (
        <div className="flex flex-col items-center gap-3 py-4" data-racer="unlock-reveal">
          <m.div
            className="size-40 overflow-hidden rounded-lg bg-sunken shadow-2"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <UmaBust outfitId={uma.id} label={uma.name} size={160} className="size-full" />
          </m.div>
          {uma.outfit !== null && <p className="text-[13px] text-ink-soft">{uma.outfit}</p>}
        </div>
      ) : (
        <div className="space-y-3" data-racer="unlock-sheet" data-uma={uma.id}>
          <div className="flex items-end gap-3">
            <div className="size-24 shrink-0 overflow-hidden rounded-md bg-sunken">
              <UmaBust outfitId={uma.id} label={uma.name} size={96} locked className="size-full" />
            </div>
            <div className="min-w-0 space-y-1 pb-1">
              {uma.outfit !== null && <p className="truncate text-[13px] text-ink-soft">{uma.outfit}</p>}
              <p className="flex items-center gap-1.5 text-[15px]" aria-label={stableWords('tickets-move', { n: tickets, next: Math.max(0, tickets - 1) })}>
                {mark}
                <span className="font-display font-bold tabular-nums" aria-hidden>{tickets} → {Math.max(0, tickets - 1)}</span>
              </p>
              <p className="text-[13px] text-ink-soft">{tickets < 1 ? stableWords('no-tickets') : stableWords('final')}</p>
            </div>
          </div>
          <Facts uma={uma} />
          {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </Sheet>
  )
}
