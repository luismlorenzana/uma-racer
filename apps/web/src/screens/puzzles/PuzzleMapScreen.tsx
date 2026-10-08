// Accessible 28-node DAG and immutable encounter preview (docs/design/uma-puzzles.md §§6,9).
import { SCENARIOS, puzzleEncounterRewards, resolvePuzzleEncounter, type PuzzleDarkVariant, type PuzzleEnemy, type PuzzleMapNode } from '@racer/domain'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { PuzzleEnemyPlaceholder } from '../../content/puzzles/Placeholder'
import type { PuzzleCastLease, PuzzleLoadedBattle } from '../../game/puzzles/host'
import { openPuzzleNode, openPuzzleParty, puzzleMapStatus, puzzleNodeName, puzzlePartySummary, puzzleRewardEstimate } from '../../game/puzzles/presentation'
import { PuzzleButton, PuzzleCard, PuzzleMaterialMark, PuzzleModal, PUZZLE_STYLE_LABEL } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
import { PuzzleWeaknessLegend } from './PuzzleGuide'
export function PuzzleMapScreen() {
  const { partyId = '', scenarioId = '' } = useParams(), { root, memory } = usePuzzles(), account = usePuzzleAccount()
  const party = account?.parties.find(p => p.partyId === partyId), valid = Boolean(party && SCENARIOS.some(s => s.id === scenarioId))
  const status = valid && account ? puzzleMapStatus(account, partyId, scenarioId) : null
  const open = status?.checkpoint?.open, frozenNode = status?.checkpoint && open && openPuzzleNode(status.checkpoint)
  const [selected, setSelected] = useState<string | null>(() => memory.read().positions[`${partyId}/${scenarioId}`] ?? null)
  const [preview, setPreview] = useState<string | null>(null), rowRefs = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    if (!valid) return
    memory.choose(partyId, scenarioId)
    const remembered = memory.read().positions[`${partyId}/${scenarioId}`] ?? null
    setSelected(remembered); setPreview(null)
    if (remembered) rowRefs.current.get(remembered)?.scrollIntoView?.({ block: 'center' })
  }, [partyId, scenarioId, valid, memory])
  const node = status?.chapter.nodes.find(n => n.id === preview)
  const otherOpen = account && openPuzzleParty(account, partyId)
  return <PuzzleFrame title={status?.chapter.name ?? 'Chapter unavailable'} back={root}><div className="grid gap-3">
    {!status || !party || !account ? <PuzzleCard>Unknown party or chapter. Return to Parties and choose a registered chapter.</PuzzleCard> : <>
      <PuzzleCard><h2 className="text-sm">{party.name} · PL {status.chapter.levelStart}–{status.chapter.levelEnd}</h2><p className="mt-1 text-xs text-ink-on-dark-soft">{status.cleared.length}/28 won · {status.full ? 'Full map cleared' : status.complete ? 'Chapter complete; more routes remain' : 'Clear any Champion to complete the chapter'}</p>
        <p className="mt-2 text-xs text-ink-on-dark-soft">Clear either squad at each row. All three Guardians unlock the five colour Champions. Won nodes remain replayable.</p>
        {open && frozenNode && <PuzzleButton className="mt-3 w-full" onClick={() => setPreview(frozenNode.id)}>Resume {puzzleNodeName(frozenNode)}</PuzzleButton>}
        {otherOpen && otherOpen.scenarioId !== scenarioId && <p className="mt-2 text-xs text-accent">This party has an open encounter in another chapter. Return to Parties to resume it.</p>}
      </PuzzleCard>
      <ol className="grid gap-1" aria-label="Chapter path, top to bottom">{[...new Set(status.chapter.nodes.map(n => n.row))].map((row, index, rows) => {
        const nodes = status.chapter.nodes.filter(n => n.row === row)
        return <li key={row}><div className={`grid gap-2 ${nodes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {nodes.map(n => {
            const won = status.cleared.includes(n.id), reached = status.reached.includes(n.id), isOpen = frozenNode?.id === n.id
            // Dark champion is chosen in its preview. Its two possible families are shown honestly here.
            const drops = n.localId === 'c-dark' ? [...puzzleEncounterRewards(n, 'pace'), ...puzzleEncounterRewards(n, 'late')] : puzzleEncounterRewards(n)
            return <button key={n.id} ref={el => { if (el) rowRefs.current.set(n.id, el); else rowRefs.current.delete(n.id) }} onClick={() => { setSelected(n.id); memory.position(partyId, scenarioId, n.id); setPreview(n.id) }}
              aria-label={`${puzzleNodeName(n)}, PL ${n.level}, ${n.elements.join(', ')}, ${isOpen ? 'open encounter, resume' : won ? 'won, replayable' : reached ? 'reached' : 'locked'}, ${drops.map(d => `${d.quantity} ${PUZZLE_STYLE_LABEL[d.style]} tickets`).join(n.localId === 'c-dark' ? ' or ' : ', ')}`}
              aria-pressed={selected === n.id} className={`min-h-11 rounded-md border p-2 text-left ${selected === n.id ? 'border-accent bg-stage-soft' : won ? 'border-accent/50 bg-stage-soft' : 'border-hairline-dark bg-stage-soft'} ${!reached ? 'opacity-55' : ''}`}>
              <span className="flex items-center justify-between gap-1"><span className="text-xs font-semibold">{puzzleNodeName(n)}</span><span className="text-[10px] text-ink-on-dark-soft">PL {n.level}</span></span>
              <span className="mt-2 flex flex-wrap gap-1">{n.elements.map((e, i) => <PuzzleElementMark key={i} element={e} size={18} />)}<span className="ml-auto flex flex-wrap gap-1">{drops.map(d => <PuzzleMaterialMark key={d.style} style={d.style} quantity={d.quantity} />)}</span></span>
              <span className="mt-1 block text-[10px] text-ink-on-dark-soft">{isOpen ? 'Resume' : won ? 'Won · replay' : reached ? 'Reached' : 'Locked'}{n.localId === 'c-dark' ? ' · choose ticket style' : ''}</span>
            </button>
          })}</div>{index < rows.length - 1 && <div aria-hidden className="mx-auto h-4 w-px bg-hairline-dark" />}</li>
      })}</ol>
    </>}
  </div>{node && status && party && <PuzzleNodePreview key={`${node.id}:${open?.ownerEpoch ?? -1}`} node={node} partyId={partyId} scenarioId={scenarioId} reached={status.reached.includes(node.id)} onClose={() => setPreview(null)} />}</PuzzleFrame>
}
function EnemyPortrait({ enemy, lease, isolated }: { enemy: PuzzleEnemy; lease: PuzzleCastLease; isolated: boolean }) {
  const presentation = lease.presentation, member = presentation?.pack.members.find(m => m.id === enemy.castId)
  if (!member || !presentation) return isolated ? <div className="h-20 w-20 shrink-0"><PuzzleEnemyPlaceholder element={enemy.element} /></div> : <p role="alert">Verified enemy portrait unavailable.</p>
  const frame = presentation.atlas.frames.find(f => f.id === member.art.frameId)!, page = presentation.atlas.pages[frame.page]!, scale = 80 / frame.width
  return <div role="img" aria-label={member.name} className="h-20 w-20 shrink-0" style={{ backgroundImage: `url(${presentation.pageUrls[frame.page]})`,
    backgroundSize: `${page.width * scale}px ${page.height * scale}px`, backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px` }} />
}
function EnemyDetails({ enemy }: { enemy: PuzzleEnemy }) {
  return <div className="mt-2 grid gap-1 text-[11px] text-ink-on-dark-soft"><p>{enemy.maxHp} HP · {enemy.defense} defence · opens in {enemy.openingCountdown} drags</p>
    {enemy.intents.map((intent, i) => <p key={i}>Every {intent.countdown} drag{intent.countdown === 1 ? '' : 's'}: {intent.type === 'attack' ? `${intent.damage} damage` : intent.type === 'heal' ? `heal lowest-HP ally by ${intent.amount}` : intent.type === 'convert' ? `convert ${intent.count} ${intent.from} orbs to ${intent.to}` : `${intent.type === 'ward' ? 'combo ward' : 'guard'}: ${Math.round(intent.reduction * 100)}% reduction, break at ${intent.comboThreshold}+ combos, ${intent.durationDrags} drags`}</p>)}
    <p>{enemy.delayImmune ? 'Immune to delay' : 'Delay can extend its countdown'}</p>{enemy.phase && <p>Rage at {enemy.phase.atHpPercent}% HP: damage ×{enemy.phase.damageMultiplier}, every {enemy.phase.countdown} drag{enemy.phase.element ? `, changes to ${enemy.phase.element}` : ''}. Drops stay unchanged.</p>}
  </div>
}
export function PuzzleNodePreview({ node, partyId, scenarioId, reached, onClose }: { node: PuzzleMapNode; partyId: string; scenarioId: string; reached: boolean; onClose(): void }) {
  const { acquire, host, isolated, command, busy, notice } = usePuzzles(), account = usePuzzleAccount()
  const checkpoint = account?.checkpoints.find(c => c.progress.partyId === partyId && c.scenarioId === scenarioId)
  const open = checkpoint?.open, sameOpen = Boolean(open && openPuzzleNode(checkpoint!)?.id === node.id)
  const [lease, setLease] = useState<PuzzleCastLease | null>(null), [loaded, setLoaded] = useState<PuzzleLoadedBattle | null>(null)
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [takeover, setTakeover] = useState(false), [entryNotice, setEntryNotice] = useState(false)
  const [variant, setVariant] = useState<PuzzleDarkVariant | null>(sameOpen && node.localId === 'c-dark' ? open!.input.rewards[0]!.style as PuzzleDarkVariant : null)
  const frozenIdentity = sameOpen ? open!.input.battleId : null, epoch = sameOpen ? open!.ownerEpoch : null
  useEffect(() => {
    let cancelled = false, held: PuzzleCastLease | null = null
    setError(null); setLease(null); setLoaded(null)
    void (async () => {
      if (frozenIdentity) {
        const view = await host.loadBattle(frozenIdentity)
        if (view.kind === 'battle') held = view.lease
        if (!cancelled) { setLoaded(view); setLease(held) }
      } else {
        held = await acquire()
        if (!isolated && !held.presentation) throw new Error('A verified presentation pack is required. No placeholder production preview is available.')
        if (!cancelled) setLease(held)
      }
      if (cancelled) held?.release()
    })().catch(e => { held?.release(); if (!cancelled) setError(e instanceof Error ? e.message : 'Required enemy content is unavailable.') })
    return () => { cancelled = true; held?.release() }
  }, [acquire, host, frozenIdentity, epoch, isolated, attempt])
  const party = account?.parties.find(p => p.partyId === partyId), summary = party && account && puzzlePartySummary(party, account)
  const requiresChoice = node.localId === 'c-dark' && !variant
  let enemies: PuzzleEnemy[] = [], recipeError: string | null = null
  try { enemies = sameOpen ? open!.input.enemies : lease && !requiresChoice ? resolvePuzzleEncounter(puzzleMapStatus(account!, partyId, scenarioId).chapter, node.id, lease.cast, variant).enemies : [] }
  catch (e) { recipeError = e instanceof Error ? e.message : 'Content does not cover this encounter.' }
  const rewards = account && !requiresChoice ? puzzleRewardEstimate(node, scenarioId, account, variant) : []
  const recovery = loaded?.kind === 'recovery' ? loaded : null
  return <PuzzleModal title={`${sameOpen ? 'Resume' : 'Preview'} ${puzzleNodeName(node)}`} onClose={onClose}><div className="grid gap-3">
    {notice && <p role="alert" className="rounded-sm border border-accent p-2 text-xs">{notice}</p>}
    <p className="text-xs text-ink-on-dark-soft">Recommended PL {node.level} · {node.kind} · {reached ? 'Reached' : 'Locked; preview only'}</p>
    {summary?.average !== null && summary?.average !== undefined && summary.average < node.level && <p className="text-xs text-accent">Low-level party: average PL {summary.average.toFixed(1)}, recommended {node.level}. You can still try with a full party.</p>}
    {sameOpen && <PuzzleCard><p className="text-xs">Frozen encounter · owner epoch {open!.ownerEpoch}. Its entrants, kit, rewards, content and seed stay unchanged.</p><p className="mt-1 text-[10px] break-all text-ink-on-dark-soft">{open!.input.battleId}</p>{loaded?.kind === 'battle' && <p className="mt-2 text-xs">Journal restored · turn {loaded.state.turn} · {loaded.actions.length} recorded actions · {loaded.state.hp}/{loaded.state.maxHp} HP</p>}</PuzzleCard>}
    {error || recipeError ? <PuzzleCard><p role="alert" className="text-sm">{error ?? recipeError}</p><div className="mt-3 flex gap-2"><PuzzleButton onClick={() => setAttempt(n => n + 1)}>Retry content</PuzzleButton><PuzzleButton secondary onClick={onClose}>Return to map</PuzzleButton></div></PuzzleCard> : !lease && !loaded ? <p role="status" className="text-xs">Verifying and holding required content…</p> : null}
    {recovery && <PuzzleCard><p role="alert" className="text-sm">{recovery.message}</p><p className="mt-2 text-xs text-ink-on-dark-soft">Read-only recovery. Never reserve a replacement encounter. Online takeover restarts this same frozen fight from turn 0 and invalidates the other device’s journal.</p>
      <PuzzleButton className="mt-3 w-full" secondary disabled={busy || !recovery.open || typeof navigator !== 'undefined' && !navigator.onLine} onClick={() => setTakeover(true)}>Review online takeover</PuzzleButton>
      {takeover && recovery.open && <div className="mt-3 grid gap-2"><p className="text-xs">Confirm takeover of epoch {recovery.open.ownerEpoch}? Same seed, board and frozen entrants; prior local actions are not carried across devices.</p><PuzzleButton disabled={busy} onClick={() => { const o = recovery.open!; void command(`takeover:${o.input.battleId}:${o.ownerEpoch}`, async () => { const v = await host.takeover(o.input.battleId, o.ownerEpoch); if (v.kind === 'battle') v.lease.release() }).then(ok => { if (ok) { setTakeover(false); setAttempt(n => n + 1) } }) }}>Confirm online takeover</PuzzleButton><PuzzleButton secondary disabled={busy} onClick={() => setTakeover(false)}>Keep read-only</PuzzleButton></div>}
    </PuzzleCard>}
    {loaded?.kind === 'result' && <PuzzleCard><p>This encounter has a {loaded.pending ? 'pending replay-validated' : 'canonical'} result. T113 adds the result view; no second fight is reserved here.</p></PuzzleCard>}
    {node.localId === 'c-dark' && <PuzzleCard><p className="text-sm">Dark Champion ticket family</p><p className="mt-1 text-xs text-ink-on-dark-soft">Choose Pace or Late before entry. The choice is frozen for this encounter, including its phase.</p><div className="mt-2 grid grid-cols-2 gap-2">{(['pace', 'late'] as const).map(v => <button key={v} disabled={sameOpen} aria-pressed={variant === v} onClick={() => setVariant(v)} className={`min-h-11 rounded-sm border px-2 ${variant === v ? 'border-accent' : 'border-hairline-dark'}`}><PuzzleMaterialMark style={v} /></button>)}</div></PuzzleCard>}
    {enemies.map(enemy => <PuzzleCard key={enemy.id}><div className="flex gap-3">{lease && <EnemyPortrait enemy={enemy} lease={lease} isolated={isolated} />}<div className="min-w-0"><h3 className="text-sm">{lease?.presentation?.pack.members.find(m => m.id === enemy.castId)?.name ?? (isolated ? 'Invented training sprite' : enemy.castId)}</h3><div className="mt-1 flex items-center gap-1 text-xs"><PuzzleElementMark element={enemy.element} /><span className="capitalize">{enemy.element}</span></div><p className="mt-1 text-xs text-ink-on-dark-soft">{enemy.recipeId.replace('puzzle:', '').replaceAll('-', ' ')}</p></div></div><EnemyDetails enemy={enemy} /></PuzzleCard>)}
    <PuzzleWeaknessLegend />
    <PuzzleCard><h3 className="text-sm">Guaranteed clear drops · current estimate</h3>{requiresChoice ? <p className="mt-2 text-xs">Choose the Dark Champion’s ticket family to view the exact gross, repayment and inventory vector.</p> : rewards.map(r => <div className="mt-2 flex items-center justify-between gap-2 text-xs" key={r.itemId}><PuzzleMaterialMark style={r.style} quantity={r.gross} /><span>Repay {r.repaid} · Inventory +{r.net}</span></div>)}<p className="mt-2 text-[10px] text-ink-on-dark-soft">Estimate uses current negative balances; the committed result applies the canonical balance once. No reward on loss or abandonment.</p></PuzzleCard>
    {node.localId === 'g1' && <PuzzleCard><p className="text-xs">{puzzleMapStatus(account!, partyId, scenarioId).chapter.tier > 1 ? 'Winning this Opening Guardian unlocks the adjacent exchange edge from the previous scenario into this one. Exchange arrives in T114.' : 'This is the first scenario. Win a higher chapter’s Opening Guardian to unlock its adjacent exchange edge.'}</p></PuzzleCard>}
    <PuzzleButton disabled={!isolated || !lease || Boolean(error || recipeError || recovery || openPuzzleParty(account!, partyId)) || !reached || !summary?.full || requiresChoice} onClick={() => setEntryNotice(true)}>{isolated ? 'Begin battle · DEV notice only' : 'Battle entry unavailable'}</PuzzleButton>
    <p className="text-xs text-ink-on-dark-soft">T113 supplies the battle screen. Entry is disabled in production; this setup preview cannot reserve an unwinnable fight.</p>
    {entryNotice && <p role="status" className="rounded-sm border border-accent p-3 text-sm">Isolated preview complete. No fight was reserved, no EXP or materials were granted. The playable board arrives in T113.</p>}
  </div></PuzzleModal>
}
