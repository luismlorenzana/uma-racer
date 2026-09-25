import {
  MAX_LIMIT_BREAK,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  cardLimitBreak,
  STATS,
  cardNodeValue,
  constellationTemplate,
  explainAptitudes,
  lineageEligibility,
  lineageUnlockLevel,
  nodeValue,
  statNodeValue,
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
} from '@racer/domain'
import { useState } from 'react'
import { Link } from 'react-router'
import { getContentAsset, type LoadedContent } from '../content/runtime'
import { setConstellationNode } from '../game/actions'
import { bondRecallHref } from '../game/bond-links'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { UmaBust } from '../ui/UmaBust'
import { BondPips } from '../ui/BondPips'
import { BottomSheet } from '../ui/BottomSheet'
import { ConstellationGraph } from '../ui/constellation/ConstellationGraph'
import { useTraining } from './TrainingScene'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

export function ConstellationScreen() {
  const { content, save, uma, cards, umas, tickets } = useTraining()
  const pushToast = useGame((state) => state.pushToast)
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)

  const { derived, run } = uma
  const template = constellationTemplate(run.tier)
  const here = `/constellation/${encodeURIComponent(save.templateId)}`
  const nodeCap = cardNodeCap(run.tier)

  const cardTypes = Object.fromEntries(
    run.cardSetIds.flatMap((id) => {
      const card = content.cards.byId.get(id)
      return card ? [[id, card.type] as const] : []
    }),
  )
  const aptitudes = explainAptitudes(uma.template.aptitudes, derived.lineage)
  const moved = aptitudes.filter((row) => row.result !== row.base)

  const assign = async (nodeId: string, assignment: NodeAssignment | null) => {
    if (busy) return
    setBusy(true)
    try {
      await setConstellationNode(save.templateId, nodeId, assignment)
      setOpenNode(null)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not change that node')
    } finally {
      setBusy(false)
    }
  }

  const openCount = unlockedNodeCount(run.tier, run.trainingLevel)
  const treeNodes = template.cardNodes + template.statNodes
  const canPlaySpark = run.started && run.trainingLevel < MAX_TRAINING_LEVEL &&
    tickets >= SPARK_MATCH_TICKET_COST

  return (
    <>
      <div className="min-h-0 flex-1 px-3">
        <ConstellationGraph
          template={template}
          trainingLevel={run.trainingLevel}
          assignments={run.assignments}
          content={content}
          cardTypes={cardTypes}
          selectedId={openNode?.id ?? null}
          onSelect={setOpenNode}
        />
      </div>

      <section className="px-4 pb-safe pt-2">
        {canPlaySpark ? (
          <Link
            to={`/minigames/spark-match/${encodeURIComponent(save.templateId)}`}
            className="mb-2 flex min-h-11 items-center justify-between rounded-xl bg-accent px-4 text-sm font-bold text-ink shadow-2"
          >
            <span>Raise Training Level</span>
            <span>{SPARK_MATCH_TICKET_COST} tickets →</span>
          </Link>
        ) : (
          <div className="mb-2 flex min-h-11 items-center justify-between rounded-xl bg-sunken px-4 text-sm font-bold text-ink-faint" aria-disabled="true">
            <span>{run.trainingLevel >= MAX_TRAINING_LEVEL ? 'Training Level maxed' : !run.started ? 'Start scenario first' : 'Raise Training Level'}</span>
            <span>{SPARK_MATCH_TICKET_COST} tickets</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold">
            Aptitudes <span className="text-ink-faint">· {derived.assignedNodes}/{openCount} of {treeNodes} nodes</span>
          </p>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {moved.length > 0
            ? moved.map((row) => (
              <span key={`${row.category}-${row.key}`} className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold">
                {titleCase(row.key)} {row.base}→<span className="text-accent">{row.result}</span>
                <span className="text-ink-faint"> ·{row.steps} step{row.steps === 1 ? '' : 's'}</span>
              </span>
            ))
            : <span className="text-[10px] text-ink-soft">Fill lineage slots to move an aptitude grade.</span>}
        </div>
      </section>

      <BottomSheet open={openNode !== null} onClose={() => setOpenNode(null)}>
        {openNode && (
          <div className="grid gap-1.5 px-4 pb-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{titleCase(openNode.kind)} node</h3>
              <span className="text-micro">
                {openNode.kind === 'stat' ? `${statNodeValue(run.tier)} raw points` : openNode.kind === 'card' ? `up to ${nodeValue(run.tier)} raw points` : 'baseline skills'}
              </span>
            </div>

            <button
              type="button"
              disabled={busy}
              className="min-h-[44px] rounded-xl bg-sunken px-3 text-left text-sm font-semibold"
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
                const bond = cardLimitBreak(owned, run.tier)
                const perNode = cardNodeValue(run.tier, { template: card, limitBreak: bond })
                const held = cardNodeCount(run, cardId)
                const onThisNode = run.assignments[openNode.id]?.kind === 'card' && (run.assignments[openNode.id] as { cardId: string }).cardId === cardId
                const full = !onThisNode && held >= nodeCap
                return (
                  <div key={cardId} className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      disabled={busy || full}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl bg-panel px-3 py-2 text-left"
                      onClick={() => void assign(openNode.id, { kind: 'card', cardId })}
                    >
                      <AtlasSprite asset={getContentAsset(content, 'card-icons', cardId)} decorative className="h-7 w-7 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{card.charName}</span>
                          <BondPips value={bond} />
                        </span>
                        <span className="text-micro">
                          {skillPoints
                            ? `${titleCase(card.type)} · ${Math.round(cardSpPerNode(run.tier, { template: card, limitBreak: bond }))} SP per node`
                            : `${titleCase(card.type)} · ${Math.round(perNode)} per node`}
                          {` · ${held}/${nodeCap} nodes${full ? ' — full' : ''}`}
                        </span>
                      </span>
                    </button>
                    {bond < MAX_LIMIT_BREAK && (
                      <Link
                        to={bondRecallHref({ cardId, tier: run.tier, umaId: save.templateId, returnTo: here })}
                        className="flex min-w-14 items-center justify-center rounded-xl bg-sunken px-2 text-[12px] font-semibold text-accent-strong"
                      >
                        Bond
                      </Link>
                    )}
                  </div>
                )
              }))}

            {openNode.kind === 'stat' && STATS.map((stat: StatKey) => (
              <button
                key={stat}
                type="button"
                disabled={busy}
                className="min-h-[44px] rounded-xl bg-panel px-3 text-left text-sm font-semibold"
                onClick={() => void assign(openNode.id, { kind: 'stat', stat })}
              >
                {titleCase(stat)} <span className="text-ink-soft">+{statNodeValue(run.tier)}</span>
              </button>
            ))}

            {(openNode.kind === 'parent' || openNode.kind === 'grandparent') && (
              <LineagePicker
                busy={busy}
                candidateIds={Object.keys(umas)}
                content={content}
                child={uma.template}
                held={derived.lineage}
                currentId={currentLineageId(run.assignments[openNode.id])}
                onPick={(templateId) => void assign(openNode.id, { kind: 'lineage', templateId })}
              />
            )}

            <LockedNote node={openNode} template={template} trainingLevel={run.trainingLevel} />
          </div>
        )}
      </BottomSheet>
    </>
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
        : `Locked — Training Levels 1–8 open the tree, and ${unlockedNodeCount(template.tier, trainingLevel)} of ${template.cardNodes + template.statNodes} are open at TL ${trainingLevel}.`}
    </p>
  )
}

function LineagePicker({
  busy,
  candidateIds,
  content,
  child,
  held,
  currentId,
  onPick,
}: {
  busy: boolean
  candidateIds: readonly string[]
  content: LoadedContent
  child: UmaTemplate
  held: readonly UmaTemplate[]
  currentId: string | null
  onPick: (templateId: string) => void
}) {
  const base: Aptitudes = child.aptitudes
  return (
    <div className="max-h-[44dvh] overflow-y-auto">
      {candidateIds.map((id) => {
        const candidate = content.umas.byId.get(id)
        if (!candidate) return null
        const others = held.filter((entry) => entry.id !== currentId)
        const eligibility = lineageEligibility(candidate, child, others)
        // What this pick would move, shown before committing to it.
        const preview = explainAptitudes(base, [...others, candidate]).filter((row) => row.result !== row.base)
        return (
          <button
            key={id}
            type="button"
            disabled={busy || !eligibility.eligible}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-panel px-3 py-2 text-left disabled:opacity-40"
            onClick={() => onPick(id)}
          >
            <UmaBust content={content} umaId={id} className="h-10 w-10 shrink-0 rounded-sm border border-hairline bg-gradient-to-b from-panel to-sunken" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{candidate.name}</span>
              <span className="text-micro">
                {eligibility.reason
                  ?? (preview.length > 0
                    ? `Moves ${preview.slice(0, 3).map((row) => `${row.key} ${row.base}→${row.result}`).join(', ')}`
                    : `${candidate.awakeningSkillIds.length} baseline skills`)}
              </span>
            </span>
            {id === currentId && <span className="shrink-0 text-[10px] font-bold text-accent">In slot</span>}
          </button>
        )
      })}
    </div>
  )
}
