// Training Level-Up Tickets on the Spark Match start screen, and the Training progress summary a Spark run and a ticket
// spend share (docs/design/training.md, D213, T088).

import { MAX_TRAINING_LEVEL, TRAINING_EXP_PER_LEVEL, addTrainingExp, maxLevelUpTickets, trainingExpToNext } from '@racer/domain'
import { Link } from 'react-router'
import { constellationNodeHref } from '../../game/constellation-links'
import type { RunRewardNode } from '../../game/minigame-host'
import { Button } from '../../ui/Button'
import { ChevronRightIcon, LevelUpIcon } from '../../ui/icons'
import { MinigameGauge } from '../../ui/minigames/MinigameGauge'

/** A unit's Training progress after a Spark run or a ticket spend: the same summary for both (D213). */
export function TrainingProgress({ umaId, tier, levelBefore, levelAfter, expBefore, expAfter, banked, granted, nodes, ticketsSpent }: {
  umaId: string
  tier: number
  levelBefore: number
  levelAfter: number
  expBefore: number
  expAfter: number
  banked: number
  granted: number
  nodes: readonly RunRewardNode[]
  ticketsSpent?: number
}) {
  const crossed = Array.from({ length: Math.max(0, levelAfter - levelBefore) }, (_, index) => levelBefore + index + 1)
  return (
    <>
      <div className="flex items-center justify-between gap-2"><h3 className="text-lg">Training progress</h3><strong>TL {levelBefore} → {levelAfter}</strong></div>
      <div className="mt-3"><MinigameGauge label="Training EXP" value={expAfter} maximum={levelAfter === MAX_TRAINING_LEVEL ? 1 : trainingExpToNext(levelAfter)} tone="accent" /></div>
      <p className="mt-2 text-sm text-ink-on-dark-soft">EXP {expBefore} → {expAfter}{crossed.length > 0 ? ` · crossed ${crossed.map((level) => `TL${level}`).join(', ')}` : ''}</p>
      {ticketsSpent !== undefined && <p className="mt-2 text-sm font-semibold text-ink-on-dark">−{ticketsSpent} Training Level-Up Ticket{ticketsSpent === 1 ? '' : 's'}</p>}
      {banked > 0 && (
        <div className="mt-3 rounded-sm border border-hairline-dark bg-black/15 px-3 py-2 text-sm">
          <p className="font-semibold text-ink-on-dark">+{banked.toLocaleString()} EXP to the Training EXP bank</p>
          {granted > 0
            ? <Link to="/farm/items" className="mt-1 flex min-h-11 items-center justify-between font-semibold text-accent"><span>+{granted} Training Level-Up Ticket{granted === 1 ? '' : 's'}</span><ChevronRightIcon size={20} aria-hidden /></Link>
            : <p className="mt-1 text-ink-on-dark-soft">Every {TRAINING_EXP_PER_LEVEL.toLocaleString()} banked becomes a Training Level-Up Ticket.</p>}
        </div>
      )}
      <section className="mt-4"><h3 className="text-lg">Nodes opened</h3>{nodes.length ? <div className="mt-2 grid gap-2">{nodes.map((node) => <Link key={node.id} to={constellationNodeHref(umaId, tier, node.id)} className="flex min-h-11 items-center justify-between rounded-sm border border-hairline-dark bg-black/15 px-3 font-semibold text-ink-on-dark"><span>{node.label}</span><ChevronRightIcon size={20} aria-hidden /></Link>)}</div> : <p className="mt-1 text-sm text-ink-on-dark-soft">No node opened; every EXP point carried forward.</p>}</section>
    </>
  )
}

/** Level-Up Tickets on the start screen: owned and banked, how many to use, and what they open (D213, T088). */
export function LevelUpTicketsPanel({ owned, bank, trainingLevel, trainingExp, opensFor, count, onCount, pending, onUse }: {
  owned: number | null
  bank: number
  trainingLevel: number
  trainingExp: number
  /** Nodes a count of tickets opens. */
  opensFor: (count: number) => number
  count: number
  onCount: (count: number) => void
  pending: boolean
  onUse: () => void
}) {
  const max = maxLevelUpTickets(trainingLevel, owned ?? 0)
  const chosen = Math.min(max, Math.max(1, count))
  const after = addTrainingExp(trainingLevel, trainingExp, chosen * TRAINING_EXP_PER_LEVEL).trainingLevel
  const opens = max > 0 ? opensFor(chosen) : 0
  const step = 'flex h-11 w-11 items-center justify-center rounded-sm border border-hairline-dark bg-black/20 text-xl font-bold text-ink-on-dark disabled:opacity-35'
  return (
    <div className="rounded-md border border-hairline-dark bg-stage-soft p-3" aria-label="Training Level-Up Tickets">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent/15 text-accent"><LevelUpIcon size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink-on-dark">Level-Up Tickets</p>
          <p className="text-[11px] text-ink-on-dark-soft">Owned {owned ?? '…'} · EXP bank {bank.toLocaleString()} / {TRAINING_EXP_PER_LEVEL.toLocaleString()}</p>
        </div>
      </div>
      {max > 0 ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" className={step} aria-label="One ticket fewer" disabled={pending || chosen <= 1} onClick={() => onCount(chosen - 1)}>−</button>
            <p className="min-w-0 flex-1 text-center text-[13px] text-ink-on-dark" aria-live="polite">
              <strong className="numeral text-base">{chosen}</strong> ticket{chosen === 1 ? '' : 's'} · TL{trainingLevel} → TL{after}{opens > 0 ? ` · opens ${opens} node${opens === 1 ? '' : 's'}` : ''}
            </p>
            <button type="button" className={step} aria-label="One ticket more" disabled={pending || chosen >= max} onClick={() => onCount(chosen + 1)}>+</button>
          </div>
          <Button className="mt-2 w-full" disabled={pending} onClick={onUse}>
            {pending ? 'Using tickets…' : `Use ${chosen} ticket${chosen === 1 ? '' : 's'}`}
          </Button>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-ink-on-dark-soft">Earned from EXP past TL10. Each one is a Training Level, used here.</p>
      )}
    </div>
  )
}
