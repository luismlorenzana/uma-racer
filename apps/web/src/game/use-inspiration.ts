// Read-only Item/queue projection; no optimistic unlocks (D250).
import { inspirationTokenId, type RpgCommandRequest } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from './db'
export function useInspiration(umaId: string, tier: number, enabled: boolean) {
  const [view, setView] = useState({ slot: 0, skill: 0, pending: false, conflict: false, error: '' })
  useEffect(() => {
    if (!enabled) return
    const subscription = liveQuery(async () => {
      const [slot, skill, queue] = await Promise.all([db.items.get(inspirationTokenId(tier, 'slot')),
        db.items.get(inspirationTokenId(tier, 'skill')), db.pendingRpgCommands.toArray()])
      const pending = queue.filter(q => (q.body as RpgCommandRequest).expected.some(e => e.kind === 'umas' && e.id === umaId ||
        e.kind === 'items' && [inspirationTokenId(tier, 'slot'), inspirationTokenId(tier, 'skill')].includes(e.id)))
      return { slot: slot?.data.quantity ?? 0, skill: skill?.data.quantity ?? 0, pending: pending.length > 0,
        conflict: pending.some(p => p.status === 'conflict'), error: '' }
    }).subscribe({ next: setView, error: (e: unknown) => setView(v => ({ ...v, error: String(e) })) })
    return () => subscription.unsubscribe()
  }, [umaId, tier, enabled])
  return view
}
