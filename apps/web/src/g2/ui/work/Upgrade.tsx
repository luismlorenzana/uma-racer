// A building's upgrade (docs/rework/07-farm.md §7, §10; docs/rework/05-training-hub.md §7, §8; T140, shared with T139):
// the next level's price against what the account holds, item by item, read from `upgradeCost` and from `upgrade` run
// on the current state, so a disabled button says why in the rule's own words (`prize-money`, `short`). It asks once
// with its whole cost, then runs `upgrade`. With `adds`, it also says what the level brings (`totalSlots`,
// `buildingSpeed`), as a Training facility's header does (05 §8). Nothing shows at Lv 3: there is nothing to buy.
import type { BuildingId } from '@racer/domain/rework/farm'
import { useState } from 'react'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext } from './useTap'
import { upgradeAdds, type UpgradeView } from './model'
import { grouped, itemName, itemsList, showWords, workWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

export function UpgradeControls({ upgrade: next, building, name, adds = false }: {
  upgrade: UpgradeView
  building: BuildingId
  /** The building's name for the question: "Upgrade the Kitchen to Lv 2 for …?" */
  name: string
  /** Say what the level brings (a Training facility's header, 05 §8). */
  adds?: boolean
}) {
  const tap = useTap()
  const context = useWordsContext()
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const items = next.items.map((row) => workWords('upgrade-item', { item: itemName(row.item), have: grouped(row.have), need: grouped(row.need) }))
  const money = workWords('upgrade-cost', { pm: grouped(next.prizeMoney) })
  const cost = [money, itemsList(next.items.map((row) => ({ item: row.item, qty: row.need })))].join(' and ')
  const brings = adds ? upgradeAdds(next) : []
  const run = async () => {
    setAsking(false)
    const answer = await tap.run('upgrade', { building }, `upgrade:${building}`)
    if (answer?.kind === 'done') setDone(answer.receipt.to)
  }
  return (
    <div data-g2="upgrade" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-action="upgrade"
          disabled={next.refusal !== null || tap.pending !== null}
          onClick={() => setAsking(true)}
          className={`${BUTTON} bg-accent text-ink`}
        >
          {workWords('upgrade', { level: next.to })}
        </button>
        <span className="min-w-0 flex-1 text-[12px] leading-snug font-semibold text-ink-soft">
          {[money, ...brings].join(' · ')}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 text-[12px] leading-snug text-ink-soft">
        {items.map((line, i) => (
          <li key={line} className={next.items[i]!.have < next.items[i]!.need ? 'font-semibold text-danger' : ''}>{line}</li>
        ))}
      </ul>
      {next.refusal !== null && <p className="text-[13px] text-ink-soft">{showWords(next.refusal, context)}</p>}
      {asking && (
        <div role="group" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px]">
          <span className="min-w-0 flex-1">{workWords('upgrade-ask', { place: name, level: next.to, cost })}</span>
          <button type="button" onClick={() => void run()} className={`${BUTTON} bg-accent text-ink`}>{workWords('yes')}</button>
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
        </div>
      )}
      {done !== null && <p role="status" className="text-[13px] text-success">{workWords('upgrade-done', { place: name, level: done })}</p>}
      <TapNoteLine tap={tap} />
    </div>
  )
}
