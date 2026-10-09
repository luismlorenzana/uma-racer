// RPG Inventory and Convert tabs (docs/design/uma-rpg.md#inventory-and-convert, D309): the scenario Inspiration tokens
// the campaign pays, the advance they repay first, and the 2:1 exchange between neighbouring scenarios.
import {
  INSPIRATION_EXCHANGE_MAX_BATCHES, SCENARIOS, inspirationAdvanceDebts, inspirationTokenId, planInspirationExchange,
  type InspirationExchangeDirection, type InspirationTokenKind,
} from '@racer/domain'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getContentAsset } from '../../content/runtime'
import { exchangeInspirationTokens } from '../../game/rpg-local'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'
import { GhostButton, PrimaryButton, RpgBar, RpgCard, RpgTabs } from '../../ui/rpg/rpg-ui'
import { RpgFrame, commit, pushToast, useRpg } from './RpgScreen'

const KIND_LABEL: Readonly<Record<InspirationTokenKind, string>> = { slot: 'Slot', skill: 'Skill' }
const scenarioName = (tier: number) => SCENARIOS[tier - 1]?.name ?? `Scenario ${tier}`

function Crest({ tier, size = 'h-9 w-9' }: { tier: number; size?: string }) {
  const { content } = useRpg()
  const scenario = SCENARIOS[tier - 1]
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white/5 ${size}`}>
    <AtlasSprite asset={scenario ? getContentAsset(content, 'scenario-icons', scenario.id) : null} alt="" decorative className="h-full w-full object-contain"
      fallback={<span className="text-[13px] font-bold text-accent">{tier}</span>} />
  </span>
}

function TokenCount({ kind, quantity }: { kind: InspirationTokenKind; quantity: number }) {
  return <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums" aria-label={`${quantity} ${KIND_LABEL[kind]} tokens`}>
    <span aria-hidden className="inline-flex"><InspirationTokenIcon kind={kind} size={20} /></span>×{quantity}
  </span>
}

export function RpgInventoryScreen() {
  const { account } = useRpg()
  const [all, setAll] = useState(false)
  const debts = account.bank?.phase === 'active' ? inspirationAdvanceDebts(account.bank) : []
  const owing = debts.some((d) => d.owed > 0)
  const total = (kind: InspirationTokenKind) => debts.filter((d) => d.itemId.endsWith(`:${kind}`))
    .reduce((sum, d) => ({ lent: sum.lent + d.lent, repaid: sum.repaid + d.repaid }), { lent: 0, repaid: 0 })
  const owedOn = (tier: number, kind: InspirationTokenKind) => debts.find((d) => d.itemId === inspirationTokenId(tier, kind))?.owed ?? 0
  const count = (tier: number, kind: InspirationTokenKind) => account.tokens[inspirationTokenId(tier, kind)] ?? 0
  const rows = SCENARIOS.filter((s) => all || count(s.tier, 'slot') + count(s.tier, 'skill') + owedOn(s.tier, 'slot') + owedOn(s.tier, 'skill') > 0)
  return <RpgFrame back="/" backLabel="Home" eyebrow="Global Uma RPG" title="Inventory" guide="map">
    <RpgTabs />
    {owing && <RpgCard className="mt-3">
      <h2 className="text-[14px] font-semibold">Inspiration advance</h2>
      <p className="mt-0.5 text-[11px] text-ink-on-dark-soft">Tokens you win or convert repay their own scenario's advance first, then land here.</p>
      <div className="mt-2 grid grid-cols-2 gap-3">{(['slot', 'skill'] as const).map((kind) => {
        const { lent, repaid } = total(kind)
        return <div key={kind} className="min-w-0">
          <p className="flex items-center gap-1 text-[12px] font-semibold"><InspirationTokenIcon kind={kind} size={18} />{KIND_LABEL[kind]}</p>
          <p className="text-[11px] text-ink-on-dark-soft"><span className="font-semibold text-ink-on-dark tabular-nums">{repaid}</span> of {lent} repaid</p>
          <RpgBar className="mt-1" value={repaid} max={lent} tone="exp" />
        </div>
      })}</div>
    </RpgCard>}
    <div className="mt-3 flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold">Inspiration tokens</h2>
      <div className="flex gap-1 rounded-sm bg-stage-soft p-1" role="group" aria-label="Scenarios shown">
        {([false, true] as const).map((on) => <button key={String(on)} type="button" aria-pressed={all === on} onClick={() => setAll(on)}
          className={`min-h-9 rounded-xs px-2.5 text-[12px] font-semibold ${all === on ? 'bg-accent text-ink' : 'text-ink-on-dark-soft'}`}>{on ? 'All' : 'Owned'}</button>)}
      </div>
    </div>
    {rows.length === 0 && <RpgCard className="mt-2"><p className="text-sm">No tokens yet. Every RPG win pays its chapter's scenario tokens.</p></RpgCard>}
    <ul className="mt-2 space-y-1.5">{rows.map((s) => {
      const owed = (['slot', 'skill'] as const).filter((k) => owedOn(s.tier, k) > 0)
      return <li key={s.id}>
        <Link to={`/rpg/convert?tier=${s.tier}`} aria-label={`${s.name}: ${count(s.tier, 'slot')} Slot and ${count(s.tier, 'skill')} Skill tokens. Convert`}
          className="grid min-h-14 grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-md border border-hairline-dark bg-stage-soft px-2.5 py-1.5">
          <Crest tier={s.tier} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{s.name}</span>
            <span className="block text-[10px] text-ink-on-dark-soft">{owed.length ? `Advance owed: ${owed.map((k) => `${owedOn(s.tier, k)} ${KIND_LABEL[k]}`).join(' · ')}` : `Scenario ${s.tier}`}</span>
          </span>
          <span className="flex items-center gap-2.5"><TokenCount kind="slot" quantity={count(s.tier, 'slot')} /><TokenCount kind="skill" quantity={count(s.tier, 'skill')} /></span>
        </Link>
      </li>
    })}</ul>
    <p className="mt-3 text-[11px] text-ink-on-dark-soft">Spend tokens on an Uma's Inspiration page in Training. Tap a scenario to convert its tokens.</p>
  </RpgFrame>
}

export function RpgConvertScreen() {
  const { account } = useRpg()
  const [search] = useSearchParams()
  const start = Number(search.get('tier'))
  const [kind, setKind] = useState<InspirationTokenKind>(search.get('kind') === 'slot' ? 'slot' : 'skill')
  const [lowerTier, setLowerTier] = useState(Number.isSafeInteger(start) && start >= 1 ? Math.min(start, SCENARIOS.length - 1) : 1)
  const [direction, setDirection] = useState<InspirationExchangeDirection>(start === SCENARIOS.length ? 'down' : 'up')
  const [batches, setBatches] = useState(1)
  const [busy, setBusy] = useState(false)
  const lower = scenarioName(lowerTier), higher = scenarioName(lowerTier + 1)
  const fromTier = direction === 'up' ? lowerTier : lowerTier + 1, toTier = direction === 'up' ? lowerTier + 1 : lowerTier
  const perBatch = direction === 'up' ? 2 : 1
  const owned = account.tokens[inspirationTokenId(fromTier, kind)] ?? 0
  const max = Math.min(INSPIRATION_EXCHANGE_MAX_BATCHES, Math.floor(owned / perBatch))
  const plan = useMemo(() => {
    try { return planInspirationExchange({ kind, lowerTier, direction, batches }, account.tokens, account.bank, 'preview', 0) }
    catch { return null }
  }, [kind, lowerTier, direction, batches, account.tokens, account.bank])
  const confirm = () => {
    setBusy(true)
    void commit(async () => {
      const done = await exchangeInspirationTokens({ kind, lowerTier, direction, batches })
      pushToast(`Converted: +${done.gross} ${scenarioName(toTier)} ${KIND_LABEL[kind]}${done.debtPaid ? ` (${done.debtPaid} repaid the advance)` : ''}`)
      setBatches(1)
    }).finally(() => setBusy(false))
  }
  const seg = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xs px-2 text-[12px] font-semibold ${on ? 'bg-accent text-ink' : 'text-ink-on-dark-soft'}`
  const side = (tier: number, label: string, amount: string, have: number) => <RpgCard className="min-w-0">
    <p className="text-[10px] font-bold tracking-[0.12em] text-ink-on-dark-soft uppercase">{label}</p>
    <div className="mt-1 flex items-center gap-2"><Crest tier={tier} size="h-8 w-8" /><InspirationTokenIcon kind={kind} size={28} /></div>
    <p className="mt-1 truncate text-[12px] font-semibold">{scenarioName(tier)}</p>
    <p className="text-[15px] font-semibold tabular-nums text-accent">{amount}</p>
    <p className="text-[10px] text-ink-on-dark-soft">{have} in Items</p>
  </RpgCard>
  return <RpgFrame back="/" backLabel="Home" eyebrow="Global Uma RPG" title="Convert" guide="map">
    <RpgTabs />
    <p className="mt-3 text-[12px] text-ink-on-dark-soft">Neighbouring scenarios, same kind: two tokens make one of the next scenario's, and one makes two of the scenario before.</p>
    <div className="mt-3 flex gap-1 rounded-sm bg-stage-soft p-1" role="group" aria-label="Token kind">
      {(['slot', 'skill'] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setBatches(1) }} className={seg(kind === k)}>
        <InspirationTokenIcon kind={k} size={18} />{KIND_LABEL[k]}</button>)}
    </div>
    <label className="mt-2 block text-[11px] font-semibold text-ink-on-dark-soft">Scenarios
      <select value={lowerTier} onChange={(e) => { setLowerTier(Number(e.target.value)); setBatches(1) }}
        className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage px-3 text-[14px] text-ink-on-dark">
        {SCENARIOS.slice(0, -1).map((s) => <option key={s.tier} value={s.tier}>{s.name} ↔ {scenarioName(s.tier + 1)}</option>)}
      </select>
    </label>
    <div className="mt-2 flex gap-1 rounded-sm bg-stage-soft p-1" role="group" aria-label="Direction">
      <button type="button" aria-pressed={direction === 'up'} aria-label={`Up: 2 ${lower} for 1 ${higher}`} onClick={() => { setDirection('up'); setBatches(1) }} className={seg(direction === 'up')}>Up · 2 → 1</button>
      <button type="button" aria-pressed={direction === 'down'} aria-label={`Down: 1 ${higher} for 2 ${lower}`} onClick={() => { setDirection('down'); setBatches(1) }} className={seg(direction === 'down')}>Down · 1 → 2</button>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {side(fromTier, 'You give', `−${perBatch * batches}`, owned)}
      {side(toTier, 'You get', `+${direction === 'up' ? batches : 2 * batches}`, account.tokens[inspirationTokenId(toTier, kind)] ?? 0)}
    </div>
    <div className="mt-3 flex items-center gap-2" aria-label="Batches">
      <GhostButton aria-label="One batch fewer" disabled={batches <= 1} onClick={() => setBatches((n) => Math.max(1, n - 1))}>−</GhostButton>
      <span className="min-w-0 flex-1 text-center text-[13px]"><b className="tabular-nums">{batches}</b> batch{batches === 1 ? '' : 'es'}</span>
      <GhostButton aria-label="One batch more" disabled={batches >= Math.max(1, max)} onClick={() => setBatches((n) => n + 1)}>+</GhostButton>
      <GhostButton disabled={max < 1 || batches === max} onClick={() => setBatches(Math.max(1, max))}>Max</GhostButton>
    </div>
    {plan && plan.debtPaid > 0 && <p className="mt-2 text-[11px] text-ink-on-dark-soft">{plan.debtPaid} of the {plan.gross} repay {scenarioName(toTier)}'s advance and can't be converted back; {plan.net} land in Items.</p>}
    {!plan && <p role="status" className="mt-2 text-[11px] text-ink-on-dark-soft">{owned < perBatch ? `You need ${perBatch} ${scenarioName(fromTier)} ${KIND_LABEL[kind]} token${perBatch === 1 ? '' : 's'} to convert.` : 'Fewer batches: not enough tokens.'}</p>}
    {account.bank?.phase === 'opening' && <p role="alert" className="mt-2 text-[11px]">Your Inspiration advance is still opening; sync to finish it before converting.</p>}
    <PrimaryButton className="mt-3" disabled={busy || !plan || account.bank?.phase === 'opening'} onClick={confirm}>
      {busy ? 'Converting…' : `Convert ${perBatch * batches} → ${direction === 'up' ? batches : 2 * batches}`}</PrimaryButton>
  </RpgFrame>
}
