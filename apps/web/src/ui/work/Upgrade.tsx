// A building's upgrade (docs/game/07-farm.md §7, §10; docs/game/05-training-hub.md §7, §8; T140, shared with T139;
// D366): one compact button in the header, the next level's Prize Money as its mark and amount. It opens one sheet with
// the whole cost against what the account holds, item by item (`upgradeCost`), what the level brings (`totalSlots`,
// `buildingSpeed`) and, from `upgrade` run on the current state, why it can't be paid in the rule's own words
// (`prize-money`, `short`); its Yes runs `upgrade`. The button stays tappable when it can't be paid, so the sheet can
// say why. Nothing shows at Lv 3: there is nothing to buy.
import type { BuildingId } from '@racer/domain/farm'
import { useState } from 'react'
import { BottomSheet } from '../BottomSheet'
import { LevelUpIcon } from '../icons'
import { ItemIcon } from '../ItemIcon'
import { UiMark } from '../UiMark'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext } from './useTap'
import { upgradeAdds, type UpgradeView } from './model'
import { grouped, itemName, itemsList, showWords, workWords } from './words'

const BUTTON = 'font-display inline-flex min-h-12 items-center justify-center rounded-sm px-4 text-[15px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

export function UpgradeButton({ upgrade: next, building, name }: {
  upgrade: UpgradeView
  building: BuildingId
  /** The building's name for the question: "Upgrade the Kitchen to Lv 2 for …?" */
  name: string
}) {
  const tap = useTap()
  const context = useWordsContext()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const money = workWords('upgrade-cost', { pm: grouped(next.prizeMoney) })
  const cost = [money, itemsList(next.items.map((row) => ({ item: row.item, qty: row.need })))].join(' and ')
  const brings = upgradeAdds(next)
  const refusal = next.refusal === null ? null : showWords(next.refusal, context)
  const title = workWords('upgrade', { level: next.to })
  const run = async () => {
    const answer = await tap.run('upgrade', { building }, `upgrade:${building}`)
    if (answer?.kind === 'done') {
      setDone(answer.receipt.to)
      setOpen(false)
    }
  }
  const label = [workWords('upgrade-label', { level: next.to, pm: grouped(next.prizeMoney) }), refusal].filter(Boolean).join('. ')
  return (
    <>
      <button
        type="button"
        data-action="upgrade"
        data-short={refusal === null ? undefined : true}
        onClick={() => { tap.clear(); setOpen(true) }}
        aria-label={label}
        className={`font-display flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold tabular-nums ${
          refusal === null ? 'border-accent bg-accent-wash text-ink' : 'border-hairline-strong bg-panel text-ink-soft'
        }`}
      >
        <LevelUpIcon size={16} />
        <UiMark mark="currency/prize-money" />
        <span>{grouped(next.prizeMoney)}</span>
      </button>
      {done !== null && <span role="status" className="sr-only">{workWords('upgrade-done', { place: name, level: done })}</span>}
      <BottomSheet open={open} onClose={() => setOpen(false)} label={title}>
        <div data-g2="upgrade" className="space-y-3 pb-2">
          <h2 className="text-lg">{title}</h2>
          {brings.length > 0 && <p className="text-[14px] font-semibold">{brings.join(' · ')}</p>}
          <ul className="grid grid-cols-3 gap-1.5 text-[13px] tabular-nums">
            <li className={`flex min-h-9 items-center gap-1.5 rounded-sm bg-sunken/60 px-2 ${next.haveMoney < next.prizeMoney ? 'font-semibold text-danger' : ''}`}>
              <UiMark mark="currency/prize-money" />
              <span>{grouped(next.haveMoney)}/{grouped(next.prizeMoney)}</span>
            </li>
            {next.items.map((row) => (
              <li
                key={row.item}
                aria-label={workWords('upgrade-item', { item: itemName(row.item), have: grouped(row.have), need: grouped(row.need) })}
                className={`flex min-h-9 items-center gap-1.5 rounded-sm bg-sunken/60 px-2 ${row.have < row.need ? 'font-semibold text-danger' : ''}`}
              >
                <ItemIcon item={row.item} scale={0.75} decorative />
                <span aria-hidden className="truncate">{grouped(row.have)}/{grouped(row.need)}</span>
              </li>
            ))}
          </ul>
          {refusal !== null
            ? <p data-g2="upgrade-why" className="text-[13px] text-ink-soft">{refusal}</p>
            : <p className="text-[13px]">{workWords('upgrade-ask', { place: name, level: next.to, cost })}</p>}
          <TapNoteLine tap={tap} />
          <div className="flex gap-2">
            <button type="button" disabled={refusal !== null || tap.pending !== null} onClick={() => void run()} className={`${BUTTON} flex-1 bg-accent text-ink`}>
              {workWords('yes')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-12 flex-1 rounded-sm font-semibold text-ink-soft">{workWords('not-now')}</button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
