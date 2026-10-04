// Signed debt is deliberately separate from spendable Items (D256).
import { inspirationToken, inspirationTokenName, type InspirationBank } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '../game/db'
import { useGame } from '../game/store'
import { useInspirationAdvanceStatus } from '../game/inspiration-advance'
import { InspirationTokenIcon } from './InspirationTokenIcon'

export function InspirationBankPanel({ tier, preview }: { tier?: number; preview?: InspirationBank }) {
  const persistent = useGame(s => s.persistent)
  const [saved, setSaved] = useState<InspirationBank | null>(null)
  const { busy, error } = useInspirationAdvanceStatus()
  useEffect(() => {
    if (preview || !persistent) return
    const sub = liveQuery(() => db.inspirationBank.get('main')).subscribe({ next: row => setSaved(row?.data ?? null) })
    return () => sub.unsubscribe()
  }, [preview, persistent])
  const bank = preview ?? saved
  if (!bank && !busy && !error) return null
  const entries = Object.entries(bank?.balances ?? {}).filter(([id, balance]) => balance < 0 && (!tier || inspirationToken(id)?.tier === tier))
  const total = -entries.reduce((sum, [, balance]) => sum + balance, 0)
  return <section aria-label="Inspiration token advance" className="my-3 space-y-2 rounded-md border border-hairline bg-panel p-3 text-ink">
    <h3 className="text-sm font-semibold">Inspiration advance · {total ? `${total} to repay` : bank?.phase === 'active' ? 'Repaid' : 'Opening'}</h3>
    <p className="text-xs leading-5 text-ink-soft">Future RPG tokens repay this bank first, then enter Items. Existing inventory stays spendable. Unlocks and debt are shared by all four distance presets.</p>
    {bank?.phase === 'opening' && <p className="text-xs text-warning">Opening {bank.opened.length}/{Object.keys(bank.cohort).length} outfits. Reconnect to finish; collection waits until complete.</p>}
    {entries.length > 0 && <details open={Boolean(tier)}><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">Negative token balances</summary><div className="space-y-2">{entries.map(([id, balance]) => {
      const token = inspirationToken(id)!
      return <div key={id} className="flex min-h-11 items-center gap-2 text-xs"><InspirationTokenIcon kind={token.kind} size={28} /><span className="flex-1">{inspirationTokenName(token.tier, token.kind)}</span><span className="font-semibold tabular-nums">{balance}</span></div>
    })}</div></details>}
    {bank && <p className="text-[11px] text-ink-faint">One-time cohort: {Object.keys(bank.cohort).length} outfits · {Object.values(bank.cohort).reduce((n, r) => n + r.tiers.length, 0)} scenario units. Later units are excluded.</p>}
    {!preview && (busy || error || bank?.phase === 'opening') && <div aria-live="polite">{error && <p role="alert" className="text-xs text-danger">{error}</p>}<button disabled={busy} className="min-h-11 rounded-sm bg-sunken px-3 text-xs font-semibold" onClick={() => { void import('../game/runtime').then(({ gameRuntime }) => gameRuntime.flush()) }}>{busy ? 'Applying advance…' : 'Sync and resume advance'}</button></div>}
  </section>
}
