import {
  MAX_STARS,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  cardStars,
  cardNodeValue,
  constellationTemplate,
  explainAptitudes,
  isNodeUnlocked,
  lineageEligibility,
  lineageUnlockLevel,
  nodeValue,
  cardNodeCap,
  cardNodeCount,
  cardSpPerNode,
  paysSkillPoints,
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
import { useEffect, useState } from 'react'
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
import { naturalLineageSkills } from '../ui/constellation/lineageSkills'
import { UmaPickerSheet, type UmaPickerSort } from '../ui/album/UmaPickerSheet'
import { useTraining } from './TrainingScene'
import { formatTickets } from '../ui/tickets'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

type NodeView = 'constellation' | 'inspiration'
type LineageSkillGroup = {
  id: string
  label: string
  uma: UmaTemplate | undefined
  skills: readonly SkillTemplate[]
}

export function InspirationScreen() { return <ConstellationScreen viewMode="inspiration" /> }

const belongsToView = (node: ConstellationNode, viewMode: NodeView) =>
  viewMode === 'constellation' ? node.kind === 'card' : node.kind === 'parent' || node.kind === 'grandparent'

export function ConstellationScreen({ viewMode = 'constellation' }: { viewMode?: NodeView }) {
  const { content, save, uma, cards, umas, tickets } = useTraining()
  const pushToast = useGame((state) => state.pushToast)
  const persistent = useGame((state) => state.persistent)
  const [searchParams] = useSearchParams()
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  // Inspiration keeps the selected planet highlighted after its assignment sheet closes.
  const [selectedLineageId, setSelectedLineageId] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillTemplate | null>(null)
  // The lineage slot whose Uma picker is open (D181).
  const [lineageNode, setLineageNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)

  const { derived, run } = uma
  const template = constellationTemplate(run.tier)
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
    if (node && belongsToView(node, viewMode) && isNodeUnlocked(template, node, run.trainingLevel)) {
      setOpenNode(node)
      if (viewMode === 'inspiration') setSelectedLineageId(node.id)
    }
  }, [run.trainingLevel, searchParams, template, viewMode])

  const assign = async (nodeId: string, assignment: NodeAssignment | null) => {
    if (busy) return
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
  const lineageSkillGroups: LineageSkillGroup[] = viewMode === 'inspiration'
    ? visibleNodes.map((node, index) => {
        const assignment = run.assignments[node.id]
        const lineageUma = assignment?.kind === 'lineage' ? content.umas.byId.get(assignment.templateId) : undefined
        const slotNumber = visibleNodes.slice(0, index + 1).filter((candidate) => candidate.kind === node.kind).length
        return {
          id: node.id,
          label: `${titleCase(node.kind)} ${slotNumber}`,
          uma: lineageUma,
          skills: lineageUma ? naturalLineageSkills(lineageUma, content.skills.byId) : [],
        }
      })
    : []
  const openCount = visibleNodes.filter((node) => isNodeUnlocked(template, node, run.trainingLevel)).length
  const filledCount = visibleNodes.filter((node) => run.assignments[node.id] !== undefined).length
  const buff = scenarioBuff(run.tier)
  const treeNodes = visibleNodes.length
  // An earlier trained unit keeps training toward TL10 (D190); her current scenario trains once started.
  const trainable = run.started || uma.past
  const canPlaySpark = trainable && run.trainingLevel < MAX_TRAINING_LEVEL &&
    tickets >= SPARK_MATCH_TICKET_COST

  return (
    <>
      <div className="min-h-[240px] min-w-0 flex-1 px-3">
        <ConstellationGraph
          template={template}
          trainingLevel={run.trainingLevel}
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
        {viewMode === 'constellation' && (canPlaySpark ? (
          <Link
            to={`/minigames/spark-match/${encodeURIComponent(save.templateId)}?return=${encodeURIComponent(here)}`}
            className="mb-2 flex min-h-11 items-center justify-between rounded-sm bg-accent px-4 text-sm font-bold text-ink shadow-2"
          >
            <span>Raise Training Level</span>
            <span>{formatTickets(SPARK_MATCH_TICKET_COST)} →</span>
          </Link>
        ) : (
          <div className="mb-2 flex min-h-11 items-center justify-between rounded-sm bg-sunken px-4 text-sm font-bold text-ink-faint" aria-disabled="true">
            <span>{run.trainingLevel >= MAX_TRAINING_LEVEL ? 'Training Level maxed' : !trainable ? 'Start scenario first' : 'Raise Training Level'}</span>
            <span>{formatTickets(SPARK_MATCH_TICKET_COST)}</span>
          </div>
        ))}
        {viewMode === 'inspiration' && <p className="mb-2 rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">Parents and grandparents lend skills and can raise aptitudes. These slots open at Training Levels 9 and 10.</p>}
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
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold">
            {viewMode === 'constellation' ? 'Card constellation' : 'Inspiration'} <span className="text-ink-faint">· {filledCount} filled · {openCount} of {treeNodes} unlocked</span>
          </p>
        </div>
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
          onSelect={setSelectedSkill}
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
              disabled={busy}
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
                const bond = cardStars(owned, run.tier)
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

            {(openNode.kind === 'parent' || openNode.kind === 'grandparent') && (
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

            <LockedNote node={openNode} template={template} trainingLevel={run.trainingLevel} />
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
          held={derived.lineage}
          currentId={currentLineageId(run.assignments[lineageNode.id])}
          onClose={() => setLineageNode(null)}
          onPick={(templateId) => void assign(lineageNode.id, { kind: 'lineage', templateId })}
        />
      )}

      <SkillDetailSheet skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
    </>
  )
}

function LineageSkillRail({
  groups,
  onSelect,
}: {
  groups: readonly LineageSkillGroup[]
  onSelect: (skill: SkillTemplate) => void
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
                {group.skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className="flex min-h-14 items-start gap-2 rounded-md border border-hairline bg-panel px-2.5 py-2 text-left transition-colors hover:border-accent/60 active:bg-accent-wash"
                    onClick={() => onSelect(skill)}
                  >
                    <SkillIcon skill={skill} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{skill.name}</span>
                        <SkillKindBadge kind={skill.kind} />
                      </span>
                      <SkillChips tags={skillTags(skill)} />
                      {skill.description && <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-ink-soft">{skill.description}</span>}
                    </span>
                  </button>
                ))}
                {group.skills.length === 0 && <p className="rounded-md bg-panel px-3 py-2 text-[12px] text-ink-soft">No natural unique or gold skills in this content pack.</p>}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-hairline bg-panel/50 px-3 py-2 text-[12px] text-ink-soft">Assign an Uma to add her natural skills.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}

function SkillDetailSheet({ skill, onClose }: { skill: SkillTemplate | null; onClose: () => void }) {
  return (
    <BottomSheet open={skill !== null} onClose={onClose}>
      {skill && (
        <div className="grid gap-3 px-1 pb-5">
          <div className="flex items-center gap-3">
            <SkillIcon skill={skill} size={52} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold leading-tight">{skill.name}</h2>
              <div className="mt-1 flex items-center gap-1.5">
                <SkillKindBadge kind={skill.kind} />
                {skill.costSp !== null && <span className="text-micro">{skill.costSp} SP</span>}
              </div>
            </div>
          </div>
          <SkillChips tags={skillTags(skill)} />
          <p className="rounded-md bg-sunken px-3 py-3 text-[13px] leading-relaxed text-ink-soft">
            {skill.description || 'No description in this content pack.'}
          </p>
        </div>
      )}
    </BottomSheet>
  )
}

const currentLineageId = (assignment: NodeAssignment | undefined): string | null =>
  assignment?.kind === 'lineage' ? assignment.templateId : null

function LockedNote({
  node,
  template,
  trainingLevel,
}: {
  node: ConstellationNode
  template: ConstellationTemplate
  trainingLevel: number
}) {
  const required = lineageUnlockLevel(template, node.id)
  const open = required !== null
    ? trainingLevel >= required
    : node.order < unlockedNodeCount(template.tier, trainingLevel)
  if (open) return null
  return (
    <p className="pt-1 text-[11px] text-ink-soft">
      {required !== null
        ? `Locked — opens at Training Level ${required}.`
        : `Locked — Training Levels 1–8 open the card nodes, and ${unlockedNodeCount(template.tier, trainingLevel)} of ${template.cardNodes} are open at TL ${trainingLevel}.`}
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
  held,
  currentId,
  onClose,
  onPick,
}: {
  node: ConstellationNode
  candidateIds: readonly string[]
  content: LoadedContent
  child: UmaTemplate
  held: readonly UmaTemplate[]
  currentId: string | null
  onClose: () => void
  onPick: (templateId: string) => void
}) {
  const base: Aptitudes = child.aptitudes
  const others = held.filter((entry) => entry.id !== currentId)
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
      disabledReason={(entry) => lineageEligibility(entry.template, child, others).reason ?? null}
      onPick={onPick}
    />
  )
}
