import {
  MAX_STARS,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  cardStars,
  cardNodeValue,
  constellationTemplate,
  explainAptitudes,
  isNodeUnlocked,
  lineageSlotEligibility,
  inspirationGoldKey, inspirationParent, inspirationTokenId, inspirationTokenName, scenarioForTier,
  nodeValue,
  cardNodeCap,
  cardNodeCount,
  cardSpPerNode,
  paysSkillPoints,
  skillChainBelow,
  unlockedNodeCount,
  type Aptitudes,
  type ConstellationNode,
  type ConstellationTemplate,
  type NodeAssignment,
  type StatKey,
  type UmaTemplate,
  type SkillTemplate,
  scenarioBuff,
  lineageSlotTakesAnyUma,
  skillTags,
} from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getContentAsset, type LoadedContent } from '../content/runtime'
import { setConstellationNode } from '../game/actions'
import { friendshipTrainingHref } from '../game/bond-links'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { UmaBust } from '../ui/UmaBust'
import { Stars } from '../ui/Stars'
import { SkillChips } from '../ui/SkillChips'
import { SkillIcon } from '../ui/SkillIcon'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { BottomSheet } from '../ui/BottomSheet'
import { ConstellationGraph } from '../ui/constellation/ConstellationGraph'
import { RpgModalFocus } from '../ui/rpg/RpgModalFocus'
import { naturalLineageSkills } from '../ui/constellation/lineageSkills'
import { UmaPickerSheet, type UmaPickerSort } from '../ui/album/UmaPickerSheet'
import { useTraining, type TrainingContext } from './TrainingScene'
import { formatTickets } from '../ui/tickets'
import { InspirationTokenIcon } from '../ui/InspirationTokenIcon'
import { useInspiration } from '../game/use-inspiration'
import { InspirationBankPanel } from '../ui/InspirationBankPanel'
import { reserveInspirationUnlock } from '../game/inspiration-host'
import { ClLevelUpButton, useClCutover, useClPreparation } from '../ui/puzzles/ClLevelUp'
import { PresetLoadButton } from '../ui/PresetLoadButton'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

type NodeView = 'constellation' | 'inspiration'
type LineageSkillGroup = {
  id: string
  label: string
  uma: UmaTemplate | undefined
  skills: readonly SkillTemplate[]
  open: boolean
  pricing: string
  status: (skill: SkillTemplate) => string
}

export function InspirationScreen() { return <ConstellationScreen viewMode="inspiration" /> }

const belongsToView = (node: ConstellationNode, viewMode: NodeView) =>
  viewMode === 'constellation' ? node.kind === 'card' : node.kind === 'parent' || node.kind === 'grandparent'

export function ConstellationScreen({ viewMode = 'constellation', preview, previewBank }: { viewMode?: NodeView; preview?: TrainingContext; previewBank?: import('@racer/domain').InspirationBank }) {
  const clCutover = useClCutover()
  const preparing = useClPreparation()
  const training = useTraining()
  const { content, save, uma, cards, umas, tickets } = preview ?? training
  const pushToast = useGame((state) => state.pushToast)
  const persistent = useGame((state) => state.persistent) && !preview
  const [searchParams] = useSearchParams()
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  // Inspiration keeps the selected planet highlighted after its assignment sheet closes.
  const [selectedLineageId, setSelectedLineageId] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillTemplate | null>(null)
  // The lineage slot whose Uma picker is open (D181).
  const [lineageNode, setLineageNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)

  const { derived, run } = uma
  const savedTokens = useInspiration(run.tier, persistent && viewMode === 'inspiration')
  const tokenView = preview ? { slot: 6, skill: 12, error: '' } : savedTokens
  const [confirmation, setConfirmation] = useState<{ nodeId: string; goldIndex: number | null; name: string } | null>(null)
  const requestUnlock = (nodeId: string, goldIndex: number | null, name: string) => { setOpenNode(null); setSelectedSkill(null); setConfirmation({ nodeId, goldIndex, name }) }
  const unlock = async () => {
    if (!confirmation || busy || !persistent) return
    setBusy(true)
    try {
      await reserveInspirationUnlock({ umaId: save.templateId, tier: run.tier, ...confirmation }, { umas: content.umas.byId, skills: content.skills.byId })
      const { gameRuntime } = await import('../game/runtime')
      await gameRuntime.refreshLocalState()
      gameRuntime.schedule()
      setConfirmation(null)
      pushToast(`${confirmation.name} unlocked`)
    } catch (error) { pushToast(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const template = useMemo(() => constellationTemplate(run.tier), [run.tier])
  const here = `/constellation/${encodeURIComponent(save.templateId)}${viewMode === 'constellation' ? '' : `/${viewMode}`}`
  const nodeCap = cardNodeCap(run.tier)

  const cardTypes = Object.fromEntries(
    run.cardSetIds.flatMap((id) => {
      const card = content.cards.byId.get(id)
      return card ? [[id, card.type] as const] : []
    }),
  )
  // A card past its cap pays nothing on the extra nodes (D134); older saves can hold more, so say so plainly.
  const overCap = run.cardSetIds.flatMap((id) => {
    const extra = cardNodeCount(run, id) - nodeCap
    const card = content.cards.byId.get(id)
    return extra > 0 && card ? [{ name: card.charName, extra }] : []
  })
  const aptitudes = explainAptitudes(uma.template.aptitudes, derived.lineage)
  const moved = aptitudes.filter((row) => row.result !== row.base)

  useEffect(() => {
    const nodeId = searchParams.get('node')
    if (!nodeId) return
    const node = template.nodes.find((candidate) => candidate.id === nodeId)
    if (node && belongsToView(node, viewMode)) {
      setOpenNode(node)
      if (viewMode === 'inspiration') setSelectedLineageId(node.id)
    }
  }, [run.trainingLevel, searchParams, template, viewMode])

  const assign = async (nodeId: string, assignment: NodeAssignment | null) => {
    if (busy || preview) return
    setBusy(true)
    try {
      await setConstellationNode(save.templateId, nodeId, assignment, run.tier)
      setOpenNode(null)
      setLineageNode(null)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not change that node')
    } finally {
      setBusy(false)
    }
  }

  const closeNode = () => setOpenNode(null)
  const selectNode = (node: ConstellationNode) => {
    setOpenNode(node)
    if (viewMode === 'inspiration') setSelectedLineageId(node.id)
  }

  const visibleNodes = template.nodes.filter((node) => belongsToView(node, viewMode))
  const mirroredGrandparent = (slot: string, templateId: string) => slot.includes('-gp') && run.inspiration.slots.some(other => {
    const assignment = run.assignments[other]
    return other.includes('-gp') && inspirationParent(other) !== inspirationParent(slot) &&
      assignment?.kind === 'lineage' && assignment.templateId === templateId
  })
  const lineageSkillGroups: LineageSkillGroup[] = viewMode === 'inspiration'
    ? visibleNodes.map((node, index) => {
        const assignment = run.assignments[node.id]
        const lineageUma = assignment?.kind === 'lineage' ? content.umas.byId.get(assignment.templateId) : undefined
        const slotNumber = visibleNodes.slice(0, index + 1).filter((candidate) => candidate.kind === node.kind).length
        const skills = lineageUma ? naturalLineageSkills(lineageUma, content.skills.byId) : []
        const golds = skills.filter(skill => skill.kind === 'gold')
        return {
          id: node.id,
          label: `${titleCase(node.kind)} ${slotNumber}`,
          uma: lineageUma,
          skills,
          open: run.inspiration.slots.includes(node.id as import('@racer/domain').InspirationSlot),
          pricing: node.kind === 'grandparent' ? lineageUma && mirroredGrandparent(node.id, lineageUma.id)
            ? 'Mirrored grandparent · normal SP' : 'Single-side grandparent · 2× SP' : 'Parent · normal SP',
          status: (skill: SkillTemplate) => skill.kind === 'gold'
            ? run.inspiration.golds.includes(inspirationGoldKey(node.id, golds.findIndex(gold => gold.id === skill.id)))
              ? 'Gold unlocked' : 'Locked · 1 skill token'
            : 'Inherited unique · slot unlocked',
        }
      })
    : []
  const selectedLineageNode = viewMode === 'inspiration'
    ? visibleNodes.find((node) => node.id === selectedLineageId)
    : undefined
  const selectedLineageAssignment = selectedLineageNode ? run.assignments[selectedLineageNode.id] : undefined
  const selectedLineageUma = selectedLineageAssignment?.kind === 'lineage'
    ? content.umas.byId.get(selectedLineageAssignment.templateId)
    : undefined
  const selectedLineageSkills = selectedLineageUma ? naturalLineageSkills(selectedLineageUma, content.skills.byId) : []
  const openCount = visibleNodes.filter((node) => isNodeUnlocked(template, node, run.trainingLevel, run.inspiration)).length
  const selectedGolds = selectedLineageSkills.filter(s => s.kind === 'gold')
  const goldIndex = selectedSkill ? selectedGolds.findIndex(s => s.id === selectedSkill.id) : -1
  const goldOpen = goldIndex < 0 || Boolean(selectedLineageNode && run.inspiration.golds.includes(inspirationGoldKey(selectedLineageNode.id, goldIndex)))
  const selectedMirrored = Boolean(selectedLineageNode && selectedLineageUma && mirroredGrandparent(selectedLineageNode.id, selectedLineageUma.id))
  const spMultiplier = selectedLineageNode?.kind === 'grandparent' && !selectedMirrored ? 2 : 1
  const selectedInherited = selectedSkill && (selectedSkill.kind === 'unique' || selectedSkill.kind === 'unique-upgraded') && selectedSkill.inheritedSkillId ? content.skills.byId.get(selectedSkill.inheritedSkillId) : selectedSkill
  const selectedPrice = selectedInherited && [...skillChainBelow(selectedInherited, content.skills.byId), selectedInherited].reduce((sum, skill) => sum + (skill.costSp ?? 0), 0) * spMultiplier
  const openNodeUnlocked = Boolean(openNode && isNodeUnlocked(template, openNode, run.trainingLevel, run.inspiration))
  const filledCount = visibleNodes.filter((node) => run.assignments[node.id] !== undefined).length
  const buff = scenarioBuff(run.tier)
  const treeNodes = visibleNodes.length
  // An earlier trained unit keeps training toward TL10 (D190); her current scenario trains once started.
  const trainable = run.started || uma.past
  const canPlaySpark = !preparing && trainable && run.trainingLevel < MAX_TRAINING_LEVEL &&
    tickets >= SPARK_MATCH_TICKET_COST

  return (
    <>
      <div className="min-h-[240px] min-w-0 flex-1 px-3">
        <ConstellationGraph
          template={template}
          trainingLevel={run.trainingLevel}
          inspiration={run.inspiration}
          assignments={run.assignments}
          content={content}
          cardTypes={cardTypes}
          selectedId={viewMode === 'inspiration' ? selectedLineageId : openNode?.id ?? null}
          onSelect={selectNode}
          onSkillSelect={setSelectedSkill}
          viewMode={viewMode}
        />
      </div>

      <section className={viewMode === 'inspiration' ? 'px-4 pt-2' : 'px-4 pb-safe pt-2'}>
        {viewMode === 'constellation' && (clCutover ? <div className="mb-2"><ClLevelUpButton outfitId={save.templateId} tier={run.tier} level={run.trainingLevel} /></div> : canPlaySpark ? (
          <Link
            to={`/minigames/spark-match/${encodeURIComponent(save.templateId)}?return=${encodeURIComponent(here)}`}
            className="mb-2 flex min-h-11 items-center justify-between rounded-sm bg-accent px-4 text-sm font-bold text-ink shadow-2"
          >
            <span>Raise Training Level</span>
            <span>{formatTickets(SPARK_MATCH_TICKET_COST)} →</span>
          </Link>
        ) : (
          <div className="mb-2 flex min-h-11 items-center justify-between rounded-sm bg-sunken px-4 text-sm font-bold text-ink-faint" aria-disabled="true">
            <span>{preparing ? 'Preparation paused · Retry from Home' : run.trainingLevel >= MAX_TRAINING_LEVEL ? 'Training Level maxed' : !trainable ? 'Start scenario first' : 'Raise Training Level'}</span>
            <span>{formatTickets(SPARK_MATCH_TICKET_COST)}</span>
          </div>
        ))}
        {viewMode === 'inspiration' && <div className="mb-2 rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">
          <div className="flex items-center justify-between gap-2">{(['slot', 'skill'] as const).map(kind => <span key={kind} className="flex items-center gap-1"><InspirationTokenIcon kind={kind} size={28} />{tokenView[kind]} {kind} tokens</span>)}<Link className="flex min-h-11 min-w-11 items-center justify-center font-semibold text-accent-strong" to={`/farm/items?item=${inspirationTokenId(run.tier, 'slot')}`}>Items</Link></div>
          <p>{run.inspiration.slots.length}/6 slots · {run.inspiration.golds.length}/12 golds open. Slots lend unique skills and aptitudes; gold moons unlock separately.</p>
          {!persistent && <p>{preview ? 'Read-only invented preview · no account changes.' : 'Unlocking needs local storage and acknowledged sync.'}</p>}
          {tokenView.error && <p role="alert">{tokenView.error}</p>}
        </div>}
        {/* The scenario's buff is always on show (D165). */}
        <p className="mb-2 rounded-md border border-accent/40 bg-accent-wash px-3 py-1.5 text-[12px]">
          <span className="font-semibold">{buff.name}</span> <span className="text-ink-soft">· {buff.rule}</span>
        </p>
        {viewMode === 'constellation' && overCap.length > 0 && (
          <p role="status" className="mb-2 rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
            {overCap.map((row) => `${row.name} is on ${row.extra} node${row.extra === 1 ? '' : 's'} past its cap of ${nodeCap}`).join(' · ')}.
            {' '}Those nodes pay nothing: move them to another card.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold">
            {viewMode === 'constellation' ? 'Card constellation' : 'Inspiration'} <span className="text-ink-faint">· {filledCount} filled · {openCount} of {treeNodes} unlocked</span>
          </p>
          {/* Once nothing is left to unlock here, the same preset one scenario earlier can be loaded (D288). */}
          {!preview && <PresetLoadButton save={save} run={run} page={viewMode} />}
        </div>
        {viewMode === 'inspiration' && (!preview || previewBank) && <InspirationBankPanel tier={run.tier} preview={previewBank} />}
        {viewMode === 'inspiration' && <div className="mt-1 flex flex-wrap gap-1">
          {moved.length > 0
            ? moved.map((row) => (
              <span key={`${row.category}-${row.key}`} className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold">
                {titleCase(row.key)} {row.base}→<span className="text-accent">{row.result}</span>
                <span className="text-ink-faint"> ·{row.steps} step{row.steps === 1 ? '' : 's'}</span>
              </span>
            ))
            : <span className="text-[10px] text-ink-soft">Fill lineage slots to move an aptitude grade.</span>}
        </div>}
      </section>

      {viewMode === 'inspiration' && (
        <LineageSkillRail
          groups={lineageSkillGroups}
          onSelect={(slot, skill) => { setSelectedLineageId(slot); setSelectedSkill(skill) }}
        />
      )}

      <BottomSheet open={openNode !== null} onClose={closeNode}>
        {openNode && (
          <div className="grid gap-1.5 px-4 pb-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{`${titleCase(openNode.kind)} node`}</h3>
              <span className="text-micro">
                {openNode.kind === 'card' ? `up to ${nodeValue(run.tier)} raw points` : 'baseline skills'}
              </span>
            </div>

            <button
              type="button"
              disabled={busy || !openNodeUnlocked}
              className="min-h-[44px] rounded-sm bg-sunken px-3 text-left text-sm font-semibold"
              onClick={() => void assign(openNode.id, null)}
            >
              Leave empty
            </button>

            {openNode.kind === 'card' && (run.cardSetIds.length === 0
              ? <p className="py-2 text-[11px] text-ink-soft">Pick a card set before filling card nodes.</p>
              : run.cardSetIds.map((cardId) => {
                const card = content.cards.byId.get(cardId)
                const owned = cards[cardId]
                if (!card || !owned) return null
                const skillPoints = paysSkillPoints(card)
                const bond = cardStars(owned)
                const perNode = cardNodeValue(run.tier, { template: card, stars: bond })
                const held = cardNodeCount(run, cardId)
                const onThisNode = run.assignments[openNode.id]?.kind === 'card' && (run.assignments[openNode.id] as { cardId: string }).cardId === cardId
                const full = !onThisNode && held >= nodeCap
                return (
                  <div key={cardId} className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      disabled={busy || full}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-sm bg-panel px-3 py-2 text-left"
                      onClick={() => void assign(openNode.id, { kind: 'card', cardId })}
                    >
                      <AtlasSprite asset={getContentAsset(content, 'card-icons', cardId)} decorative className="h-7 w-7 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{card.charName}</span>
                          <Stars value={bond} />
                        </span>
                        <span className="text-micro">
                          {skillPoints
                            ? `${titleCase(card.type)} · ${Math.round(cardSpPerNode(run.tier, { template: card, stars: bond }))} SP per node`
                            : `${titleCase(card.type)} · ${Math.round(perNode)} per node`}
                          {` · ${held}/${nodeCap} nodes${full ? ' — full' : ''}`}
                        </span>
                      </span>
                    </button>
                    {bond < MAX_STARS && (
                      <Link
                        to={friendshipTrainingHref({ cardId, tier: run.tier, umaId: save.templateId, returnTo: here })}
                        className="flex min-w-14 items-center justify-center rounded-sm bg-sunken px-2 text-[12px] font-semibold text-accent-strong"
                      >
                        Bond
                      </Link>
                    )}
                  </div>
                )
              }))}

            {openNodeUnlocked && (openNode.kind === 'parent' || openNode.kind === 'grandparent') && (
              <LineageSlot
                busy={busy}
                content={content}
                currentId={currentLineageId(run.assignments[openNode.id])}
                onChoose={() => {
                  setLineageNode(openNode)
                  setOpenNode(null)
                }}
              />
            )}

            {!openNodeUnlocked && openNode.kind !== 'card' && <><p className="text-sm text-ink-soft">{openNode.kind === 'grandparent' && !run.inspiration.slots.includes(inspirationParent(openNode.id)) ? 'Open this side’s parent slot first.' : 'One scenario slot token opens this position permanently.'}</p><button type="button" disabled={busy || !persistent || tokenView.slot < 1 || openNode.kind === 'grandparent' && !run.inspiration.slots.includes(inspirationParent(openNode.id))} className="min-h-11 rounded-sm bg-accent px-3 font-semibold" onClick={() => requestUnlock(openNode.id, null, lineageSkillGroups.find(group => group.id === openNode.id)?.label ?? titleCase(openNode.kind))}>Unlock {openNode.kind} · 1 slot token</button></>}
            {openNode.kind === 'card' && <LockedNote node={openNode} template={template} trainingLevel={run.trainingLevel} cl={clCutover} />}
          </div>
        )}
      </BottomSheet>

      {lineageNode && (
        <LineagePickerSheet
          node={lineageNode}
          // Legends (tier 10): the first parent slot takes any Uma, owned or not (D165).
          candidateIds={lineageSlotTakesAnyUma(run.tier, lineageNode.id) ? content.umas.items.map((entry) => entry.id) : Object.keys(umas)}
          content={content}
          child={uma.template}
          assignments={run.assignments}
          currentId={currentLineageId(run.assignments[lineageNode.id])}
          onClose={() => setLineageNode(null)}
          onPick={(templateId) => void assign(lineageNode.id, { kind: 'lineage', templateId })}
        />
      )}

      <SkillDetailSheet skill={selectedSkill} onClose={() => setSelectedSkill(null)} price={selectedPrice || undefined}
        note={goldOpen ? `Full chain from this slot · ${spMultiplier === 2 ? 'single-side grandparent 2× SP' : 'normal SP'}. The Skills page uses the cheapest available source and shares prerequisites.` : 'Locked gold · unlock with one scenario skill token, then equip using SP.'}
        unlock={!goldOpen && selectedLineageNode ? () => requestUnlock(selectedLineageNode.id, goldIndex, selectedSkill!.name) : undefined} />
      {confirmation && <RpgModalFocus onClose={() => setConfirmation(null)}><BottomSheet open onClose={() => setConfirmation(null)}><div className="space-y-3 pb-safe">
        <InspirationTokenIcon kind={confirmation.goldIndex === null ? 'slot' : 'skill'} size={56} />
        <h2 className="font-display text-xl">Unlock {confirmation.name}?</h2><p>{uma.template.name} · {scenarioForTier(run.tier)?.name}</p>
        <p className="text-sm text-ink-soft">Consumes 1 {inspirationTokenName(run.tier, confirmation.goldIndex === null ? 'slot' : 'skill')}. This position stays open when its ancestor changes. No {clCutover ? 'Constellation' : 'Training'} Level required.</p>
        <button type="button" disabled={busy || !persistent} onClick={() => void unlock()} className="min-h-11 w-full rounded-sm bg-accent px-3 font-semibold">Confirm · 1 token</button>
      </div></BottomSheet></RpgModalFocus>}
    </>
  )
}

function LineageSkillRail({
  groups,
  onSelect,
}: {
  groups: readonly LineageSkillGroup[]
  onSelect: (slot: string, skill: SkillTemplate) => void
}) {
  const filledCount = groups.filter((group) => group.uma).length
  const skillCount = groups.reduce((total, group) => total + group.skills.length, 0)

  return (
    <section className="max-h-[30dvh] overflow-y-auto overscroll-contain px-4 pb-safe pt-2">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-micro">Complete inheritance setup</p>
          <h2 className="font-display text-lg font-bold">Inheritance skill bank</h2>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-ink-soft">{filledCount}/{groups.length} Umas · {skillCount} skills</span>
      </div>
      <div className="grid gap-2">
        {groups.map((group) => (
          <section key={group.id} className="rounded-md border border-hairline bg-sunken p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{group.label}</p>
              <p className="min-w-0 truncate text-[12px] font-semibold">{group.uma?.name ?? 'Empty slot'}</p>
            </div>
            {group.uma ? (
              <div className="grid gap-1.5">
                <p className="text-xs text-ink-soft">{group.pricing}</p>
                {group.skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className="flex min-h-14 items-start gap-2 rounded-md border border-hairline bg-panel px-2.5 py-2 text-left transition-colors hover:border-accent/60 active:bg-accent-wash"
                    onClick={() => onSelect(group.id, skill)}
                  >
                    <SkillIcon skill={skill} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{skill.name}</span>
                        <SkillKindBadge kind={skill.kind} />
                      </span>
                      <SkillChips tags={skillTags(skill)} />
                      <span className="block text-xs font-semibold text-accent-strong">{group.status(skill)}</span>
                      {skill.description && <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-ink-soft">{skill.description}</span>}
                    </span>
                  </button>
                ))}
                {group.skills.length === 0 && <p className="rounded-md bg-panel px-3 py-2 text-[12px] text-ink-soft">No natural unique or gold skills in this content pack.</p>}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-hairline bg-panel/50 px-3 py-2 text-[12px] text-ink-soft">{group.open ? 'Assign an Uma to add her natural skills.' : 'Locked slot · 1 scenario slot token.'}</p>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}

function SkillDetailSheet({ skill, onClose, price, note, unlock }: { skill: SkillTemplate | null; onClose: () => void; price?: number; note?: string; unlock?: () => void }) {
  if (!skill) return null
  return (
    <RpgModalFocus onClose={onClose}><BottomSheet open onClose={onClose}>
        <div className="grid gap-3 px-1 pb-5">
          <div className="flex items-center gap-3">
            <SkillIcon skill={skill} size={52} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold leading-tight">{skill.name}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <SkillKindBadge kind={skill.kind} />
                {(price ?? skill.costSp) !== null && <span className="text-micro">{price ?? skill.costSp} SP</span>}
              </div>
            </div>
          </div>
          <SkillChips tags={skillTags(skill)} />
          {note && <p className="text-sm text-ink-soft">{note}</p>}
          {unlock && <button type="button" className="min-h-11 rounded-sm bg-accent px-3 font-semibold" onClick={unlock}>Unlock gold · 1 skill token</button>}
          <p className="rounded-md bg-sunken px-3 py-3 text-[13px] leading-relaxed text-ink-soft">
            {skill.description || 'No description in this content pack.'}
          </p>
        </div>
    </BottomSheet></RpgModalFocus>
  )
}

const currentLineageId = (assignment: NodeAssignment | undefined): string | null =>
  assignment?.kind === 'lineage' ? assignment.templateId : null

function LockedNote({
  node,
  template,
  trainingLevel,
  cl,
}: {
  node: ConstellationNode
  template: ConstellationTemplate
  trainingLevel: number
  cl: boolean
}) {
  const open = node.order < unlockedNodeCount(template.tier, trainingLevel)
  if (open) return null
  return (
    <p className="pt-1 text-[11px] text-ink-soft">
      {`Locked — ${cl ? 'Constellation' : 'Training'} Levels 1–8 open the card nodes, and ${unlockedNodeCount(template.tier, trainingLevel)} of ${template.cardNodes} are open at ${cl ? 'CL' : 'TL'} ${trainingLevel}.`}
    </p>
  )
}

/** The slot sheet's lineage section: who holds it, and the way into the picker. */
function LineageSlot({
  busy,
  content,
  currentId,
  onChoose,
}: {
  busy: boolean
  content: LoadedContent
  currentId: string | null
  onChoose: () => void
}) {
  const current = currentId ? content.umas.byId.get(currentId) : undefined
  return (
    <div className="grid gap-1.5">
      {current && (
        <div className="flex min-h-[44px] items-center gap-2 rounded-sm bg-panel px-3 py-2">
          <UmaBust content={content} umaId={current.id} className="h-10 w-10 shrink-0 rounded-sm border border-hairline bg-gradient-to-b from-panel to-sunken" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{current.name}</span>
            <span className="text-micro">In this slot</span>
          </span>
        </div>
      )}
      <button type="button" disabled={busy} onClick={onChoose} className="min-h-[44px] rounded-sm bg-accent px-3 text-sm font-semibold text-ink">
        {current ? 'Choose another Uma' : 'Choose an Uma'}
      </button>
    </div>
  )
}

/**
 * The lineage slot's Uma picker: eligibility and what each pick would move, with an "Aptitude gain" sort beside the
 * shared level order (D181).
 */
function LineagePickerSheet({
  node,
  candidateIds,
  content,
  child,
  assignments,
  currentId,
  onClose,
  onPick,
}: {
  node: ConstellationNode
  candidateIds: readonly string[]
  content: LoadedContent
  child: UmaTemplate
  assignments: Readonly<Record<string, NodeAssignment>>
  currentId: string | null
  onClose: () => void
  onPick: (templateId: string) => void
}) {
  const base: Aptitudes = child.aptitudes
  const slots = new Map(Object.entries(assignments).flatMap(([slot, assignment]) => {
    const entry = assignment.kind === 'lineage' ? content.umas.byId.get(assignment.templateId) : null
    return entry ? [[slot, entry] as const] : []
  }))
  const others = [...slots].filter(([slot]) => slot !== node.id).map(([, entry]) => entry)
  // What each pick would move, shown before committing to it.
  const moves = (template: UmaTemplate) => explainAptitudes(base, [...others, template]).filter((row) => row.result !== row.base)
  const gain: UmaPickerSort = {
    key: 'aptitudeGain',
    label: 'Aptitude gain',
    direction: 'desc',
    value: (entry) => moves(entry.template).reduce((sum, row) => sum + row.steps, 0),
  }
  return (
    <UmaPickerSheet
      open
      onClose={onClose}
      title={node.kind === 'parent' ? 'Choose a parent' : 'Choose a grandparent'}
      content={content}
      candidateIds={candidateIds.filter((id) => id !== child.id)}
      selectedIds={currentId ? [currentId] : []}
      selectedLabel="In slot"
      sorts={[gain]}
      describe={(entry) => {
        const preview = moves(entry.template)
        return preview.length > 0
          ? `Moves ${preview.slice(0, 3).map((row) => `${row.key} ${row.base}→${row.result}`).join(', ')}`
          : `${entry.template.awakeningSkillIds.length} baseline skills`
      }}
      disabledReason={(entry) => lineageSlotEligibility(entry.template, child, node.id, slots).reason ?? null}
      onPick={onPick}
    />
  )
}
