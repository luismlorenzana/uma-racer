// Her constellation at the Observatory, full screen (docs/rework/05-training-hub.md §4, §8; docs/rework/11-hub-and-
// places.md §6; T139): `TreeGraph` with pinch zoom, or the **List** of 44 pt rows that VoiceOver reads, each node in its
// state. Tapping one opens its sheet: an open node's card and the skills it pays there, with the set's other cards
// under the per-card cap (`set-assignments`, refusals in words); a locked node what it needs and, for the next one,
// **Unlock** into the session sheet with her and that node.
import { TYPE_COLOR } from '../../card-library/model'
import { CheckIcon, LockedIcon } from '../../../ui/icons'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DISTANCE_LABEL } from '../../../ui/labels'
import { Sheet } from '../../../ui/Sheet'
import { Tabs } from '../../../ui/Tabs'
import { TreeGraph, type TreeGraphNode, type TreeNodeLook } from '../../../ui/TreeGraph'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap } from '../../../ui/work/useTap'
import { cardName } from '../../../ui/words'
import { BuildFrame, type BuildContext } from '../BuildFrame'
import { unlockPath } from '../common'
import type { BuildViewProps } from '../Page'
import { trainingWords } from '../words'
import { nodeChoices, observatoryView, type NodeView } from './model'

const look = (node: NodeView): TreeNodeLook => {
  switch (node.state) {
    case 'open': return node.cardId === null ? 'empty' : 'open'
    case 'available': return 'next'
    case 'session':
    case 'queued': return 'session'
    case 'finished': return 'finished'
    default: return 'locked'
  }
}

function nodeLine(node: NodeView, build: BuildContext): string {
  if (node.state !== 'open') return `${node.title}. ${node.words ?? ''}`
  return node.cardId === null
    ? trainingWords('node-open-empty', { n: node.order })
    : trainingWords('node-open', { n: node.order, card: cardName(build.content, node.cardId) })
}

function NodeSheet({ node, build, cap, onClose }: { node: NodeView; build: BuildContext; cap: number; onClose: () => void }) {
  const tap = useTap()
  const { uma, preset, settled, now, context, content, here } = build
  const choices = useMemo(() => (node.state === 'open' ? nodeChoices(settled, uma, preset, node.id, now, context, content) : []), [node, settled, uma, preset, now, context, content])
  const skills = node.skills.map((id) => content.skills.get(id)?.name ?? id)
  const presetName = DISTANCE_LABEL[preset]
  return (
    <div className="space-y-3 pb-2" data-g2="node-sheet" data-node={node.id}>
      <h2 className="text-lg">{node.title}</h2>
      {node.state !== 'open' ? (
        <>
          <p className="text-[14px]">{node.words}</p>
          {node.unlock !== null && (
            <Link to={unlockPath(uma.outfitId, node.unlock, here)} state={{ back: true }} data-action="unlock"
              className="font-display flex min-h-12 items-center justify-center rounded-sm bg-accent font-semibold text-ink shadow-1">
              {trainingWords('unlock')}
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="text-[14px]">{node.cardId === null ? trainingWords('node-empty', { preset: presetName }) : trainingWords('node-card', { card: cardName(content, node.cardId) })}</p>
          {node.cardId !== null && <p className="text-[13px] text-ink-soft">{skills.length > 0 ? trainingWords('node-pays', { skills: skills.join(', ') }) : trainingWords('node-pays-none')}</p>}
          <h3 className="text-micro">{trainingWords('node-change', { preset: presetName })}</h3>
          {choices.length <= 1 && <p className="text-[13px] text-ink-soft">{trainingWords('node-cards-none', { preset: presetName })}</p>}
          <ul className="space-y-1">
            {choices.filter((choice) => choices.length > 1 || choice.cardId !== null).map((choice) => (
              <li key={choice.cardId ?? 'empty'}>
                <button
                  type="button"
                  aria-pressed={choice.chosen}
                  disabled={choice.chosen || tap.pending !== null}
                  data-choice={choice.cardId ?? 'empty'}
                  onClick={() => void tap.run('set-assignments', { umaId: uma.outfitId, preset, assignments: choice.assignments }, `assign:${uma.outfitId}`).then((answer) => {
                    if (answer?.kind === 'done') onClose()
                  })}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left ${choice.chosen ? 'bg-accent-wash ring-1 ring-accent' : 'bg-sunken/50'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{choice.cardId === null ? trainingWords('leave-empty') : cardName(content, choice.cardId)}</span>
                    {choice.cardId !== null && <span className="block text-[12px] text-ink-soft">{trainingWords('node-held', { n: choice.held, cap })}</span>}
                    {choice.refusal !== null && !choice.chosen && <span className="block text-[12px] text-ink-soft">{choice.refusal}</span>}
                  </span>
                  {choice.chosen && <CheckIcon size={20} />}
                </button>
              </li>
            ))}
          </ul>
          <Link to={`/training/dojo/${encodeURIComponent(uma.outfitId)}?preset=${preset}`} state={{ back: true }} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-accent-strong underline">
            {trainingWords('set-link', { preset: presetName })}
          </Link>
          <TapNoteLine tap={tap} />
        </>
      )}
    </div>
  )
}

function Tree({ build }: { build: BuildContext }) {
  const [mode, setMode] = useState<'tree' | 'list'>('tree')
  const [selected, setSelected] = useState<string | null>(null)
  const model = useMemo(() => observatoryView(build.settled, build.uma, build.preset, build.derived, build.now, build.context, build.content), [build])
  if (model === null) return null
  const drawn = model.nodes.filter((node) => node.x !== null)
  const graphNodes: TreeGraphNode[] = drawn.map((node) => ({
    id: node.id,
    x: node.x!,
    y: node.y!,
    label: nodeLine(node, build),
    look: look(node),
    tone: node.cardType === null ? null : TYPE_COLOR[node.cardType],
    mark: node.state === 'waiting' || node.state === 'later' ? <LockedIcon size={16} /> : node.order,
  }))
  const node = model.nodes.find((entry) => entry.id === selected) ?? null
  return (
    <div className="space-y-3 px-4 py-3" data-g2="observatory-view">
      <Tabs label={trainingWords('tree')} value={mode} onChange={setMode} options={[{ value: 'tree', label: trainingWords('tree') }, { value: 'list', label: trainingWords('list') }]} />
      {mode === 'tree' ? (
        <>
          <TreeGraph root={model.root} nodes={graphNodes} edges={model.edges.map((edge) => ({ from: edge.from.id, to: edge.to.id }))} selectedId={selected} onSelect={setSelected} />
          <p className="text-[12px] text-ink-soft">{trainingWords('zoom-hint')}</p>
        </>
      ) : (
        <ul className="space-y-1" data-g2="node-list">
          {model.nodes.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => setSelected(entry.id)} data-node={entry.id} data-state={entry.state}
                className="flex min-h-11 w-full items-center gap-2 rounded-sm bg-sunken/50 px-2 py-1.5 text-left text-[13px]">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: entry.cardType === null ? 'var(--color-hairline-strong)' : TYPE_COLOR[entry.cardType] }} />
                <span className="min-w-0 flex-1">{nodeLine(entry, build)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={node !== null} onClose={() => setSelected(null)} label={node?.title}>
        {node !== null && <NodeSheet node={node} build={build} cap={model.cap} onClose={() => setSelected(null)} />}
      </Sheet>
    </div>
  )
}

export default function TreeView({ place, umaId }: BuildViewProps) {
  return (
    <BuildFrame place={place} umaId={umaId} fullScreen title={(name) => trainingWords('tree-title', { uma: name })}>
      {(build) => <Tree build={build} />}
    </BuildFrame>
  )
}
