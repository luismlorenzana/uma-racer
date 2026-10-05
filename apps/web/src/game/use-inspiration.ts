// Live scenario token stock for the Inspiration page; unlocks commit locally (D263).
import { inspirationTokenId } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from './db'
export function useInspiration(tier: number, enabled: boolean) {
  const [view, setView] = useState({ slot: 0, skill: 0, error: '' })
  useEffect(() => {
    if (!enabled) return
    const subscription = liveQuery(async () => {
      const [slot, skill] = await Promise.all([db.items.get(inspirationTokenId(tier, 'slot')), db.items.get(inspirationTokenId(tier, 'skill'))])
      return { slot: slot?.data.quantity ?? 0, skill: skill?.data.quantity ?? 0, error: '' }
    }).subscribe({ next: setView, error: (e: unknown) => setView(v => ({ ...v, error: String(e) })) })
    return () => subscription.unsubscribe()
  }, [tier, enabled])
  return view
}
