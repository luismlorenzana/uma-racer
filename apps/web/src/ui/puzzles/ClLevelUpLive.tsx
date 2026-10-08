// Account-backed adapter shared by three training callers and the established Global Items route (§7–9).
import { SCENARIOS, parsePuzzleMaterialId } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useContent } from '../../content/ContentProvider'
import { useGame } from '../../game/store'
import type { PuzzleHost, PuzzleAccount } from '../../game/puzzles/host'
import { ConstellationMaterials } from '../ConstellationMaterials'
import { ClSpendSheet, MaterialOperationStatus } from './ClSpendSheet'
type Props = { outfitId: string; tier: number; level: number } | { visibility: 'owned' | 'all'; scenarioTier: number | null }
export default function ClLevelUpLive(props: Props) {
  const [host, setHost] = useState<PuzzleHost | null>(null), [account, setAccount] = useState<PuzzleAccount | null>(null), [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null)
  const content = useContent(), persistent = useGame(s => s.persistent)
  useEffect(() => { let active = true
    if (!persistent || content.status !== 'ready') return
    void import('../../game/runtime').then(async ({ gameRuntime }) => { const h = await gameRuntime.puzzleHost(); if (active) setHost(h) }).catch(e => { if (active) setError(String(e)) })
    return () => { active = false }
  }, [persistent, content.status])
  useEffect(() => { if (!host) return
    const sub = liveQuery(() => host.account()).subscribe({ next: setAccount, error: e => setError(String(e)) }); return () => sub.unsubscribe()
  }, [host])
  if ('visibility' in props) return account ? <>
    <ConstellationMaterials stocks={account.stocks} bank={account.bank} visibility={props.visibility} scenarioTier={props.scenarioTier} itemsTo="/farm/items" chaptersTo="/puzzles/chapters" exchangeTo="/puzzles/exchange" recipients={id => {
      const material = parsePuzzleMaterialId(id), tier = SCENARIOS.find(s => s.id === material?.scenarioId)?.tier
      if (!material || !tier || content.status !== 'ready') return []
      return account.umas.filter(u => u.scenarios.some(s => s.tier === tier) && content.content.umas.byId.get(u.templateId)?.aptitudes.strategy[material.style] === 'A').map(u => ({ id: u.templateId, name: content.content.umas.byId.get(u.templateId)?.name ?? u.templateId, href: `/constellation/${encodeURIComponent(u.templateId)}?tier=${tier}` }))
    }} />{account.materialOperations.filter(o => o.status !== 'accepted').map(o => <MaterialOperationStatus key={o.id} account={account} id={o.id} />)}
  </> : <p role="status">{error ?? 'Loading material inventory…'}</p>
  return <><button type="button" className="flex min-h-11 items-center gap-2 rounded-sm bg-accent/15 px-3 text-xs font-semibold text-accent-strong" onClick={() => setOpen(true)}>CL {props.level}/10 · {props.level === 10 ? 'Maxed' : 'Level up'}</button>
    {open && host && account ? <ClSpendSheet host={host} account={account} outfitId={props.outfitId} tier={props.tier} onClose={() => setOpen(false)} refresh={async () => setAccount(await host.account())} /> : open && <p role="status">{error ?? 'Loading saved CL account…'}</p>}</>
}
