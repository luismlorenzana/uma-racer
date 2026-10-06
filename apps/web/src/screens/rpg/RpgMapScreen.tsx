// Chapter map: a top-to-bottom route of fights, camps, sub-bosses and five elemental champions (D262, D263).
// Tap a node to preview it; clear nodes open the ones below, and any cleared fight can be replayed.
import {
  RPG_CHAPTER_LEVELS, RPG_STAGE_NAMES, battleWeaponKind, projectRpgStats, rpgBattleExp, rpgBattleTokens, rpgCarriedMp, rpgMemberLevel,
  rpgNodeParents, rpgNodeStatus, rpgRunId, inspirationTokenName, type BattleEnemy,
  type RpgCampaignChapter, type RpgMapNode, type RpgProfile, type RpgRunSaveV2,
} from '@racer/domain'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { beginRpgFight, openRpgRun, restRpgRun, rpgOutfitProfiles } from '../../game/rpg-local'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { RpgEnemyPortrait } from '../../ui/rpg/RpgEnemyPortrait'
import { RPG_ELEMENT_LABELS } from '../../ui/rpg/RpgPortrait'
import { ELEMENT_RING, ElementMark, GhostButton, PrimaryButton, RpgBar, ShieldBadge, WeaknessIcons, formatRpgBand, formatRpgLevel } from '../../ui/rpg/rpg-ui'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'
import { CheckIcon } from '../../ui/icons'
import { ScreenState } from '../../ui/ScreenState'
import { RpgFrame, commit, pushToast, useRpg } from './RpgScreen'

const ROW = 96
const NODE = 52

function NodeIcon({ kind }: { kind: RpgMapNode['kind'] }) {
  const path = kind === 'camp' ? 'M3 19 12 4l9 15H3Zm9-15v15m-4 0 4-6 4 6'
    : kind === 'boss' ? 'M3 8l4 4 5-7 5 7 4-4-2 10H5L3 8Zm2 12h14'
    : kind === 'sub-boss' ? 'M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Zm0 5v8m-3-4h6'
    : 'M5 19 19 5m-4 0h4v4M5 5l14 14M5 15v4h4'
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>
}

const KIND_LABEL: Record<RpgMapNode['kind'], string> = { camp: 'Camp', fight: 'Fight', 'sub-boss': 'Sub-boss', boss: 'Champion' }

export function RpgMapScreen() {
  const { presetId = '', chapterId = '' } = useParams()
  const { account, chapters, release } = useRpg()
  const navigate = useNavigate()
  const chapter = chapters?.find((c) => c.id === chapterId) ?? null
  const preset = account.presets.find((p) => p.id === presetId)?.data
  const run = account.runs.find((r) => r.id === rpgRunId(presetId, chapterId))?.data ?? null
  const [selected, setSelected] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (preset && preset.slots.every(Boolean)) void openRpgRun(presetId, chapterId) }, [presetId, chapterId, Boolean(preset)])
  const profiles = rpgOutfitProfiles(account)
  const party = (preset?.slots ?? []).flatMap((slot) => { const p = slot && profiles.get(slot.outfitId); return p ? [{ profile: p, slot: slot! }] : [] })
  const frontier = useMemo(() => chapter ? Math.max(0, ...chapter.nodes.filter((n) => rpgNodeStatus(chapter, run, n.id) === 'available').map((n) => n.row)) : 0, [chapter, run])
  useLayoutEffect(() => {
    const el = scroller.current?.closest('main')
    if (el && chapter) el.scrollTop = Math.max(0, frontier * ROW - el.clientHeight / 2)
  }, [chapter?.id])
  if (!chapter || !preset) {
    return <ScreenState title={release?.status === 'unavailable' ? 'Campaign unavailable' : 'Loading chapter'} detail={release?.status === 'unavailable' ? release.reason : 'Building the map…'} action={{ label: 'Chapters', to: `/rpg/party/${presetId}` }} />
  }
  if (party.length < 5) return <ScreenState title="Party incomplete" detail="Fill all five slots to enter a chapter." action={{ label: 'Edit party', to: `/rpg/party/${presetId}/edit` }} />
  const mpNow = party.reduce((sum, m) => sum + (run ? rpgCarriedMp(run, m.profile) : projectRpgStats(m.profile).mp), 0)
  const mpMax = party.reduce((sum, m) => sum + projectRpgStats(m.profile).mp, 0)
  const node = selected ? chapter.nodes.find((n) => n.id === selected) ?? null : null
  const stageRows = RPG_STAGE_NAMES.map((name, stage) => ({ name, row: Math.min(...chapter.nodes.filter((n) => n.stage === stage && n.kind !== 'camp').map((n) => n.row)) }))
  return <RpgFrame back={`/rpg/party/${presetId}`} backLabel="Chapters" eyebrow={`${preset.name} · ${formatRpgBand(chapter.levelStart, chapter.levelStart + RPG_CHAPTER_LEVELS - 1)}`} title={chapter.title} guide="map">
    <div className="sticky top-0 z-10 -mx-4 border-b border-hairline-dark bg-stage/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px]"><span className="w-16 text-ink-on-dark-soft">Party MP</span><RpgBar className="flex-1" value={mpNow} max={mpMax} tone="mp" /><span className="w-16 text-right">{Math.round(100 * mpNow / Math.max(1, mpMax))}%</span></div>
      {run?.battle && <PrimaryButton className="mt-2" onClick={() => navigate(`/rpg/party/${presetId}/${chapterId}/fight`)}>Resume fight · {chapter.nodes.find((n) => n.id === run.battle!.nodeId)?.name}</PrimaryButton>}
    </div>
    <div ref={scroller} className="relative mt-2" style={{ height: chapter.rows * ROW }}>
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${chapter.rows * ROW}`} preserveAspectRatio="none" aria-hidden>
        {chapter.nodes.flatMap((from) => from.exits.map((to) => {
          const target = chapter.nodes.find((n) => n.id === to)!
          const open = rpgNodeStatus(chapter, run, from.id) === 'cleared'
          return <line key={`${from.id}-${to}`} x1={(from.col + 0.5) * 20} y1={from.row * ROW + NODE / 2 + 8} x2={(target.col + 0.5) * 20} y2={target.row * ROW + NODE / 2 + 8}
            stroke={open ? 'var(--color-accent)' : 'rgba(255,255,255,0.18)'} strokeWidth={open ? 2.5 : 1.5} strokeDasharray={open ? undefined : '4 4'} vectorEffect="non-scaling-stroke" />
        }))}
      </svg>
      {stageRows.map(({ name, row }) => Number.isFinite(row) && <p key={name} className="absolute left-0 text-[9px] font-bold tracking-[0.16em] text-ink-on-dark-soft uppercase" style={{ top: row * ROW - 14 }}>{name}</p>)}
      {chapter.nodes.map((n) => <MapNode key={n.id} node={n} status={rpgNodeStatus(chapter, run, n.id)} wins={run?.wins[n.id] ?? 0} open={run?.battle?.nodeId === n.id} onOpen={() => setSelected(n.id)} />)}
    </div>
    {node && <NodeSheet chapter={chapter} node={node} run={run} party={party.map((m) => m.profile)} loadouts={party.map((m) => m.slot.loadout)} presetId={presetId}
      onClose={() => setSelected(null)} onFight={() => navigate(`/rpg/party/${presetId}/${chapterId}/fight`)} />}
  </RpgFrame>
}

function MapNode({ node, status, wins, open, onOpen }: { node: RpgMapNode; status: 'locked' | 'available' | 'cleared'; wins: number; open: boolean; onOpen: () => void }) {
  const big = node.kind === 'boss' || node.kind === 'sub-boss'
  const tone = status === 'cleared' ? 'border-accent bg-accent/20 text-ink-on-dark' : status === 'available' ? 'border-white bg-stage-soft text-ink-on-dark' : 'border-hairline-dark bg-stage text-ink-on-dark-soft'
  return <button type="button" onClick={onOpen} aria-label={`${node.name}, ${KIND_LABEL[node.kind]}${node.kind === 'camp' ? '' : `, ${formatRpgLevel(node.level)}`}, ${status}`}
    className={`absolute flex w-[20%] -translate-x-1/2 flex-col items-center ${status === 'locked' ? 'opacity-45' : ''}`} style={{ left: `${(node.col + 0.5) * 20}%`, top: node.row * ROW + 8 }}>
    <span className={`relative flex items-center justify-center rounded-full border-2 ${tone} ${node.element ? `ring-2 ring-offset-2 ring-offset-stage ${ELEMENT_RING[node.element]}` : ''} ${status === 'available' ? 'shadow-[0_0_14px_rgba(255,255,255,0.35)]' : ''}`}
      style={{ width: big ? NODE + 6 : NODE, height: big ? NODE + 6 : NODE }}>
      <NodeIcon kind={node.kind} />
      {status === 'cleared' && node.kind !== 'camp' && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[9px] font-bold text-ink">{wins > 1 ? `×${wins}` : <CheckIcon size={16} />}</span>}
      {open && <span className="absolute -left-1 -top-1 rounded-full bg-[#ff8a5c] px-1 text-[9px] font-bold text-ink">!</span>}
    </span>
    <span className="mt-0.5 text-[10px] font-semibold leading-3">{node.kind === 'camp' ? 'Camp' : formatRpgLevel(node.level)}</span>
    {node.enemies.length > 0 && <span className="flex gap-0.5">{node.enemies.map((e) => <ElementMark key={e.id} element={e.element} className="scale-75" />)}</span>}
  </button>
}

function NodeSheet({ chapter, node, run, party, loadouts, presetId, onClose, onFight }: {
  chapter: RpgCampaignChapter; node: RpgMapNode; run: RpgRunSaveV2 | null; party: RpgProfile[]; loadouts: ReadonlyArray<readonly import('@racer/domain').RpgSkillRef[]>
  presetId: string; onClose: () => void; onFight: () => void
}) {
  const { content, release } = useRpg()
  const [busy, setBusy] = useState(false)
  const status = rpgNodeStatus(chapter, run, node.id)
  const portraits = release?.status === 'ready' ? release.portraits : {}
  const castName = (id: string) => release?.status === 'ready' ? release.cast.find((c) => c.id === id)?.name ?? id : id
  const wins = run?.wins[node.id] ?? 0
  const name = (id: string) => content.umas.byId.get(id)?.name ?? id
  /** Who in the party can chip this foe: by weapon (Attack) or by an equipped skill's element. */
  const chippers = (enemy: BattleEnemy) => party.flatMap((p, i) => {
    const byWeapon = enemy.weaknesses.weapons.includes(battleWeaponKind(p.weapon))
    const byElement = loadouts[i]!.some((ref) => ref.element === enemy.weaknesses.element)
    return byWeapon || byElement ? [`${name(p.outfitId)} (${[byWeapon && 'Attack', byElement && `${RPG_ELEMENT_LABELS[enemy.weaknesses.element]} skill`].filter(Boolean).join(', ')})`] : []
  })
  const fight = async () => {
    setBusy(true)
    if (await commit(() => beginRpgFight(chapter, presetId, node.id))) onFight()
    setBusy(false)
  }
  const rest = async () => {
    setBusy(true)
    if (await commit(() => restRpgRun(chapter, presetId, node.id))) { pushToast('Rested: MP restored'); onClose() }
    setBusy(false)
  }
  const exp = node.kind === 'camp' ? [] : party.map((p) => rpgBattleExp(node.kind as 'fight', node.level, rpgMemberLevel(p)))
  const tokens = node.kind === 'camp' ? null : rpgBattleTokens(node.kind)
  return <RpgModalFocus onClose={onClose}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={node.name} onClick={(e) => e.stopPropagation()}
      className="pb-safe max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-lg border border-hairline-dark bg-stage-soft p-4 text-ink-on-dark">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-[10px] font-bold tracking-[0.14em] text-accent uppercase">{KIND_LABEL[node.kind]}{node.kind === 'camp' ? '' : ` · ${formatRpgLevel(node.level)}`}{wins > 0 && node.kind !== 'camp' ? ` · won ×${wins}` : ''}</p>
          <h2 className="text-xl">{node.name}</h2></div>
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
      {node.kind === 'camp' ? <div className="mt-3 space-y-3">
        <p className="text-sm text-ink-on-dark-soft">Resting refills every party member's MP. HP is always full when a fight starts.</p>
        <PrimaryButton disabled={busy || status === 'locked' || Boolean(run?.battle)} onClick={() => void rest()}>{status === 'locked' ? 'Reach this camp first' : run?.battle ? 'Finish the open fight first' : 'Rest · refill MP'}</PrimaryButton>
      </div> : <div className="mt-3 space-y-2">
        {node.enemies.map((enemy) => {
          const able = chippers(enemy)
          return <div key={enemy.id} className="grid grid-cols-[44px_1fr] gap-2 rounded-sm border border-hairline-dark p-2">
            <RpgEnemyPortrait content={content} artId={portraits[enemy.castId]} name={castName(enemy.castId)} className="h-12 w-11" />
            <div className="min-w-0 text-[12px]">
              <p className="flex flex-wrap items-center gap-1 font-semibold">{castName(enemy.castId)} <ElementMark element={enemy.element} label /></p>
              <p className="mt-0.5 flex items-center gap-1.5 text-ink-on-dark-soft"><ShieldBadge value={enemy.shield} /><WeaknessIcons weaknesses={enemy.weaknesses} /><span>HP {enemy.stats.hp}</span></p>
              <p className={able.length ? 'text-accent' : 'text-ink-on-dark-soft'}>{able.length ? `Can chip: ${able.join(' · ')}` : 'Nobody in this party can chip it'}</p>
              <p className="truncate text-[11px] text-ink-on-dark-soft">{[...enemy.moves, ...enemy.phaseTwo?.moves ?? []].map((m) => m.label).join(' · ')}</p>
            </div>
          </div>
        })}
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-stage px-3 py-2 text-[12px]">
          <span>EXP {Math.min(...exp)}{Math.max(...exp) !== Math.min(...exp) ? `–${Math.max(...exp)}` : ''} each</span>
          {tokens && <><span className="flex items-center gap-1"><InspirationTokenIcon kind="slot" size={18} />+{tokens.slot}</span><span className="flex items-center gap-1"><InspirationTokenIcon kind="skill" size={18} />+{tokens.skill}</span></>}
          <span className="w-full text-[10px] text-ink-on-dark-soft">{inspirationTokenName(chapter.tier, 'slot').replace('Slot ', '')} · repays your advance first</span>
        </div>
        <PrimaryButton disabled={busy || status === 'locked' || (Boolean(run?.battle) && run?.battle?.nodeId !== node.id)}
          onClick={() => { if (run?.battle?.nodeId === node.id) onFight(); else void fight() }}>
          {status === 'locked' ? `Clear ${rpgNodeParents(chapter, node.id).length > 1 ? 'a node' : 'the node'} above first` : run?.battle?.nodeId === node.id ? 'Resume fight' : run?.battle ? 'Finish the open fight first' : wins > 0 ? 'Fight again' : 'Fight'}
        </PrimaryButton>
      </div>}
    </div>
  </div></RpgModalFocus>
}
