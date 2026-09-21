import {
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  cardLimitBreak,
  STATS,
  cardNodeValue,
  capProfile,
  constellationTemplate,
  explainAptitudes,
  lineageEligibility,
  lineageUnlockLevel,
  nodeValue,
  unlockedNodeCount,
  type Aptitudes,
  type ConstellationNode,
  type ConstellationTemplate,
  type NodeAssignment,
  type StatKey,
  type Stats,
  type UmaTemplate,
} from '@racer/domain'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { getContentAsset, type LoadedContent } from '../content/runtime'
import { setConstellationNode } from '../game/actions'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { ConstellationGraph } from '../ui/constellation/ConstellationGraph'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { ScreenState } from '../ui/ScreenState'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

export function ConstellationScreen() {
  const { umaId = '' } = useParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const umas = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const profile = useGame((state) => state.profile)
  const pushToast = useGame((state) => state.pushToast)
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)
  /** Stats as they were when this screen opened, so every delta reads against one stable reference. */
  const baseline = useRef<Stats | null>(null)

  const save = umas[umaId]
  const joined = useMemo(
    () => (contentState.status === 'ready' && save ? joinUma(save, contentState.content, cards) : null),
    [cards, contentState, save],
  )

  if (contentState.status !== 'ready' || status !== 'ready') {
    return <ScreenState title="Opening constellation…" detail="Loading private content and your local save." />
  }
  if (!save || !joined || joined.status !== 'ready') {
    return (
      <ScreenState
        title="Uma not found"
        detail="This Uma is not owned in your Stable."
        action={{ label: 'Back to Stable', to: '/stable' }}
      />
    )
  }

  const content = contentState.content
  const uma = joined.value
  const { derived, run } = uma
  const template = constellationTemplate(run.tier)
  const caps = capProfile(run.tier)
  if (baseline.current === null) baseline.current = derived.stats

  const cardTypes = Object.fromEntries(
    run.cardSetIds.flatMap((id) => {
      const card = content.cards.byId.get(id)
      return card ? [[id, card.type] as const] : []
    }),
  )
  const scenarioCardId = run.cardSetIds[template.scenarioSlot] ?? null
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
    (profile?.tickets ?? 0) >= SPARK_MATCH_TICKET_COST

  return (
    <div className="flex h-dvh flex-col bg-page pt-safe">
      <header className="flex items-center justify-between px-4 py-2">
        <Link to={`/stable/${encodeURIComponent(save.templateId)}`} className="text-sm font-semibold text-ink-soft">
          ← {uma.template.name}
        </Link>
        <div className="flex gap-1">
          <Crest>{uma.scenario?.name ?? `Tier ${run.tier}`}</Crest>
          <Crest tone="accent">TL {run.trainingLevel}</Crest>
        </div>
      </header>

      <div className="flex gap-1.5 px-3 pb-1">
        {STATS.map((stat) => {
          const value = derived.stats[stat]
          const delta = value - (baseline.current?.[stat] ?? value)
          return (
            <div key={stat} className="min-w-0 flex-1 rounded-lg bg-panel px-1.5 py-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[9px] font-semibold uppercase text-ink-faint">{stat.slice(0, 3)}</span>
                {delta !== 0 && (
                  <span className={`text-[9px] font-bold ${delta > 0 ? 'text-go' : 'text-danger'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
              <Numeral className="block text-[14px] leading-tight">{value}</Numeral>
              <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (value / caps[stat]) * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
        <div className="min-w-0 flex-1 rounded-lg bg-sunken px-1.5 py-1">
          <span className="text-[9px] font-semibold uppercase text-ink-faint">SP</span>
          <Numeral className="block text-[14px] leading-tight">{derived.skillPoints}</Numeral>
          <span className="text-[8px] text-ink-faint">of {uma.spCap}</span>
        </div>
      </div>

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
          <Link to={`/stable/${encodeURIComponent(save.templateId)}/deck`} className="text-[11px] font-semibold text-accent">
            Card set
          </Link>
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
              <span className="text-micro">{nodeValue(run.tier)} raw points</span>
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
                const isScenario = cardId === scenarioCardId
                return (
                  <button
                    key={cardId}
                    type="button"
                    disabled={busy}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-panel px-3 py-2 text-left"
                    onClick={() => void assign(openNode.id, { kind: 'card', cardId })}
                  >
                    <AtlasSprite asset={getContentAsset(content, 'card-icons', cardId)} decorative className="h-7 w-7 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{card.charName}</span>
                      <span className="text-micro">
                        {isScenario
                          ? 'Scenario card · pays skill points, not stats'
                          : `${titleCase(card.type)} · LB${cardLimitBreak(owned, run.tier)} · ${Math.round(cardNodeValue(run.tier, { template: card, limitBreak: cardLimitBreak(owned, run.tier) }))} per node`}
                      </span>
                    </span>
                  </button>
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
                {titleCase(stat)} <span className="text-ink-soft">+{nodeValue(run.tier)}</span>
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
    </div>
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
            <AtlasSprite asset={getContentAsset(content, 'uma-icons', id)} decorative className="h-7 w-7 rounded-full" />
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
