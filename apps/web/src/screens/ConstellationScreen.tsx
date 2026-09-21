import {
  STATS,
  cardNodeValue,
  capProfile,
  constellationTemplate,
  isNodeUnlocked,
  lineageEligibility,
  nodeValue,
  unlockedNodeCount,
  type ConstellationNode,
  type NodeAssignment,
  type StatKey,
} from '@racer/domain'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { setConstellationNode } from '../game/actions'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { BottomSheet } from '../ui/BottomSheet'
import { Crest } from '../ui/Crest'
import { Meter } from '../ui/Meter'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

/**
 * The constellation, as a grouped list. M013 replaces this with the real graph on a dark stage; this version
 * exists so every node kind is assignable and the derived stats can be checked end to end.
 */
export function ConstellationScreen() {
  const { umaId = '' } = useParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const umas = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const pushToast = useGame((state) => state.pushToast)
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)

  const save = umas[umaId]
  const joined = useMemo(
    () => (contentState.status === 'ready' && save ? joinUma(save, contentState.content, cards) : null),
    [cards, contentState, save],
  )

  if (contentState.status !== 'ready' || status !== 'ready') {
    return <ScreenState title="Opening constellation…" detail="Loading private content and your local save." />
  }
  if (!save || !joined || joined.status !== 'ready') {
    return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  }

  const uma = joined.value
  const { derived, run } = uma
  const template = constellationTemplate(run.tier)
  const caps = capProfile(run.tier)
  const unlocked = unlockedNodeCount(run.tier, run.trainingLevel)
  const cardNodes = template.nodes.filter((node) => node.kind === 'card')
  const statNodes = template.nodes.filter((node) => node.kind === 'stat')
  const lineageNodes = template.nodes.filter((node) => node.kind === 'parent' || node.kind === 'grandparent')

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

  const label = (node: ConstellationNode): string => {
    const assignment = run.assignments[node.id]
    if (!assignment) return 'Empty'
    if (assignment.kind === 'stat') return titleCase(assignment.stat)
    if (assignment.kind === 'card') return contentState.content.cards.byId.get(assignment.cardId)?.charName ?? assignment.cardId
    return contentState.content.umas.byId.get(assignment.templateId)?.name ?? assignment.templateId
  }

  const nodeButton = (node: ConstellationNode) => {
    const open = isNodeUnlocked(template, node, run.trainingLevel)
    const filled = run.assignments[node.id] !== undefined
    return (
      <button
        key={node.id}
        type="button"
        disabled={!open || busy}
        onClick={() => setOpenNode(node)}
        className={`min-h-[44px] rounded-xl border px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
          !open
            ? 'border-transparent bg-sunken text-ink-faint'
            : filled
              ? 'border-accent bg-panel text-ink'
              : 'border-dashed border-ink-faint bg-panel text-ink-soft'
        }`}
      >
        <span className="block truncate">{open ? label(node) : 'Locked'}</span>
      </button>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col gap-3 bg-page px-4 pt-safe pb-24">
      <header className="flex items-center justify-between pt-3">
        <Link to={`/stable/${encodeURIComponent(save.templateId)}`} className="text-sm font-semibold text-ink-soft">← {uma.template.name}</Link>
        <div className="flex gap-1">
          <Crest>{uma.scenario?.name ?? `Tier ${run.tier}`}</Crest>
          <Crest tone="accent">TL {run.trainingLevel}</Crest>
        </div>
      </header>

      <Panel>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Derived stats</h2>
          <span className="text-micro">{derived.assignedNodes} / {unlocked} nodes filled</span>
        </div>
        <div className="mt-2 grid gap-1.5">
          {STATS.map((stat) => (
            <div key={stat}>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>{titleCase(stat)}</span>
                <span><Numeral>{derived.stats[stat]}</Numeral> / {caps[stat]}</span>
              </div>
              <Meter value={derived.stats[stat] / caps[stat]} color="var(--color-accent)" height={5} />
            </div>
          ))}
          <div className="mt-1 flex justify-between text-[11px] font-semibold">
            <span>Skill points</span>
            <span><Numeral>{derived.skillPoints}</Numeral> / {uma.spCap}</span>
          </div>
        </div>
        <p className="mt-2 text-micro">
          One node pays {nodeValue(run.tier)} raw points at full limit break. Changing nodes is free and instant.
        </p>
      </Panel>

      <Panel>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Card nodes</h2>
          <Link to={`/stable/${encodeURIComponent(save.templateId)}/deck`} className="text-[11px] font-semibold text-accent">Edit card set</Link>
        </div>
        {run.cardSetIds.length === 0
          ? <p className="mt-2 text-[11px] text-ink-soft">Pick a card set before filling these nodes.</p>
          : <div className="mt-2 grid grid-cols-3 gap-1.5">{cardNodes.map(nodeButton)}</div>}
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold">Stat nodes</h2>
        <p className="text-micro">Free choice — where the Stamina a Mile race wants comes from.</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">{statNodes.map(nodeButton)}</div>
      </Panel>

      <Panel>
        <h2 className="text-sm font-semibold">Lineage</h2>
        <p className="text-micro">Opens at Training Level 9 and 10. Moves aptitudes and adds baseline skills.</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">{lineageNodes.map(nodeButton)}</div>
      </Panel>

      <BottomSheet open={openNode !== null} onClose={() => setOpenNode(null)}>
        {openNode && (
          <div className="grid gap-1.5 px-4 pb-6">
            <h3 className="text-sm font-semibold">Fill this node</h3>
            <button type="button" className="min-h-[44px] rounded-xl bg-sunken text-left text-sm px-3" onClick={() => void assign(openNode.id, null)}>
              Leave empty
            </button>

            {openNode.kind === 'card' && run.cardSetIds.map((cardId) => {
              const card = contentState.content.cards.byId.get(cardId)
              const owned = cards[cardId]
              if (!card || !owned) return null
              const scenarioSlot = run.cardSetIds[template.scenarioSlot] === cardId
              return (
                <button key={cardId} type="button" className="min-h-[44px] rounded-xl bg-panel px-3 py-2 text-left" onClick={() => void assign(openNode.id, { kind: 'card', cardId })}>
                  <span className="block text-sm font-semibold">{card.charName}</span>
                  <span className="text-micro">
                    {scenarioSlot
                      ? `Scenario slot · pays skill points`
                      : `${titleCase(card.type)} · LB${owned.limitBreak} · ${Math.round(cardNodeValue(run.tier, { template: card, limitBreak: owned.limitBreak }))} per node`}
                  </span>
                </button>
              )
            })}

            {openNode.kind === 'stat' && STATS.map((stat: StatKey) => (
              <button key={stat} type="button" className="min-h-[44px] rounded-xl bg-panel px-3 text-left text-sm font-semibold" onClick={() => void assign(openNode.id, { kind: 'stat', stat })}>
                {titleCase(stat)} +{nodeValue(run.tier)}
              </button>
            ))}

            {(openNode.kind === 'parent' || openNode.kind === 'grandparent') && (
              <div className="max-h-[50dvh] overflow-y-auto">
                {Object.keys(umas).map((id) => {
                  const candidate = contentState.content.umas.byId.get(id)
                  if (!candidate) return null
                  const held = derived.lineage.filter((entry) => run.assignments[openNode.id]?.kind !== 'lineage' || entry.id !== id)
                  const eligibility = lineageEligibility(candidate, uma.template, held)
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!eligibility.eligible}
                      className="min-h-[44px] w-full rounded-xl bg-panel px-3 py-2 text-left disabled:opacity-40"
                      onClick={() => void assign(openNode.id, { kind: 'lineage', templateId: id })}
                    >
                      <span className="block text-sm font-semibold">{candidate.name}</span>
                      <span className="text-micro">{eligibility.reason ?? `${candidate.awakeningSkillIds.length} baseline skills`}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
