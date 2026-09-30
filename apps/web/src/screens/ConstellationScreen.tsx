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
  scenarioBuff,
  buffedStatNodeValue,
  lineageSlotTakesAnyUma,
  farmCropById,
  farmCropFor,
  produceAssignmentRevision,
  produceAssignmentStat,
  type FarmCropDefinition,
  type InventoryStackData,
} from '@racer/domain'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getContentAsset, type LoadedContent } from '../content/runtime'
import { consumeConstellationProduce, listProduceInventory, setConstellationNode } from '../game/actions'
import { friendshipTrainingHref } from '../game/bond-links'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { UmaBust } from '../ui/UmaBust'
import { Stars } from '../ui/Stars'
import { BottomSheet } from '../ui/BottomSheet'
import { ConstellationGraph } from '../ui/constellation/ConstellationGraph'
import { UmaPickerSheet, type UmaPickerSort } from '../ui/album/UmaPickerSheet'
import { useTraining } from './TrainingScene'
import { formatTickets } from '../ui/tickets'
import { CropMark } from '../ui/farm/CropMark'
import { TypeIcon } from '../ui/TypeIcon'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

export function ConstellationScreen() {
  const { content, save, uma, cards, umas, tickets } = useTraining()
  const pushToast = useGame((state) => state.pushToast)
  const persistent = useGame((state) => state.persistent)
  const [searchParams] = useSearchParams()
  const [openNode, setOpenNode] = useState<ConstellationNode | null>(null)
  // The lineage slot whose Uma picker is open (D181).
  const [lineageNode, setLineageNode] = useState<ConstellationNode | null>(null)
  const [busy, setBusy] = useState(false)
  const [produceInventory, setProduceInventory] = useState<InventoryStackData[] | null>(null)
  const [confirmCrop, setConfirmCrop] = useState<FarmCropDefinition | null>(null)
  const [produceResult, setProduceResult] = useState<{ crop: FarmCropDefinition; before: number; after: number } | null>(null)

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
    if (node && isNodeUnlocked(template, node, run.trainingLevel)) setOpenNode(node)
  }, [run.trainingLevel, searchParams, template])

  useEffect(() => {
    if (openNode?.kind !== 'stat' || !persistent) return
    let active = true
    setProduceInventory(null)
    void listProduceInventory(run.tier).then((inventory) => {
      if (active) setProduceInventory(inventory)
    }).catch((reason) => {
      if (active) pushToast(reason instanceof Error ? reason.message : 'Could not read Produce inventory')
    })
    return () => { active = false }
  }, [openNode?.id, openNode?.kind, persistent, pushToast, run.tier])

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

  const consumeProduce = async () => {
    if (!openNode || openNode.kind !== 'stat' || !confirmCrop || busy) return
    setBusy(true)
    try {
      const expectedRevision = produceAssignmentRevision(run.assignments[openNode.id])
      if (expectedRevision === null) throw new Error('That node does not hold Produce')
      const receipt = await consumeConstellationProduce({
        umaId: save.templateId,
        tier: run.tier,
        nodeId: openNode.id,
        itemId: confirmCrop.id,
        expectedRevision,
      })
      setProduceInventory((current) => current?.map((stack) => stack.itemId === receipt.movement.itemId
        ? { ...stack, quantity: receipt.quantityAfter }
        : stack) ?? null)
      setProduceResult({ crop: confirmCrop, before: receipt.quantityBefore, after: receipt.quantityAfter })
      setConfirmCrop(null)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not fill that Produce node')
      try { setProduceInventory(await listProduceInventory(run.tier)) } catch { /* The original error is actionable. */ }
    } finally {
      setBusy(false)
    }
  }

  const closeNode = () => {
    setOpenNode(null)
    setConfirmCrop(null)
    setProduceResult(null)
  }

  const openCount = unlockedNodeCount(run.tier, run.trainingLevel)
  const buff = scenarioBuff(run.tier)
  const statPay = buffedStatNodeValue(run.tier, statNodeValue(run.tier))
  const treeNodes = template.cardNodes + template.statNodes
  // An earlier trained unit keeps training toward TL10 (D190); her current scenario trains once started.
  const trainable = run.started || uma.past
  const canPlaySpark = trainable && run.trainingLevel < MAX_TRAINING_LEVEL &&
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
        )}
        {/* The scenario's buff is always on show (D165). */}
        <p className="mb-2 rounded-md border border-accent/40 bg-accent-wash px-3 py-1.5 text-[12px]">
          <span className="font-semibold">{buff.name}</span> <span className="text-ink-soft">· {buff.rule}</span>
        </p>
        {overCap.length > 0 && (
          <p role="status" className="mb-2 rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
            {overCap.map((row) => `${row.name} is on ${row.extra} node${row.extra === 1 ? '' : 's'} past its cap of ${nodeCap}`).join(' · ')}.
            {' '}Those nodes pay nothing: move them to another card or a stat.
          </p>
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

      <BottomSheet open={openNode !== null} onClose={closeNode}>
        {openNode && (
          <div className="grid gap-1.5 px-4 pb-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{openNode.kind === 'stat' ? 'Produce node' : `${titleCase(openNode.kind)} node`}</h3>
              <span className="text-micro">
                {openNode.kind === 'stat' ? `+${statPay} stat` : openNode.kind === 'card' ? `up to ${nodeValue(run.tier)} raw points` : 'baseline skills'}
              </span>
            </div>

            {openNode.kind !== 'stat' && (
              <button
                type="button"
                disabled={busy}
                className="min-h-[44px] rounded-sm bg-sunken px-3 text-left text-sm font-semibold"
                onClick={() => void assign(openNode.id, null)}
              >
                Leave empty
              </button>
            )}

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

            {openNode.kind === 'stat' && (
              <ProduceNodeContents
                assignment={run.assignments[openNode.id]}
                tier={run.tier}
                statPay={statPay}
                inventory={produceInventory}
                persistent={persistent}
                busy={busy}
                confirmCrop={confirmCrop}
                result={produceResult}
                onChoose={setConfirmCrop}
                onBack={() => { setConfirmCrop(null); setProduceResult(null) }}
                onConfirm={() => void consumeProduce()}
              />
            )}

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
    </>
  )
}

const currentLineageId = (assignment: NodeAssignment | undefined): string | null =>
  assignment?.kind === 'lineage' ? assignment.templateId : null

export function ProduceNodeContents({
  assignment,
  tier,
  statPay,
  inventory,
  persistent,
  busy,
  confirmCrop,
  result,
  onChoose,
  onBack,
  onConfirm,
}: {
  assignment: NodeAssignment | undefined
  tier: number
  statPay: number
  inventory: InventoryStackData[] | null
  persistent: boolean
  busy: boolean
  confirmCrop: FarmCropDefinition | null
  result: { crop: FarmCropDefinition; before: number; after: number } | null
  onChoose: (crop: FarmCropDefinition) => void
  onBack: () => void
  onConfirm: () => void
}) {
  const currentStat = produceAssignmentStat(assignment, tier)
  const currentCrop = assignment?.kind === 'produce' ? farmCropById(assignment.itemId) : null

  if (result) {
    return (
      <div className="grid gap-3" role="status">
        <div className="flex items-center gap-3 rounded-md bg-go/10 p-3">
          <CropMark crop={result.crop} size={58} />
          <div className="min-w-0">
            <p className="text-micro text-go">Produce set</p>
            <p className="truncate font-display text-lg font-bold">{result.crop.name}</p>
            <p className="flex items-center gap-1 text-[12px] text-ink-soft">
              <TypeIcon type={result.crop.stat} size={17} /> {titleCase(result.crop.stat)} +{statPay}
            </p>
          </div>
        </div>
        <p className="rounded-sm bg-sunken px-3 py-2 text-[12px]">
          Inventory <strong>{result.before} → {result.after}</strong>. The live stat strip above now reflects this node.
        </p>
        <Link
          to={`/farm/items?item=${encodeURIComponent(result.crop.id)}`}
          className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-3 text-sm font-bold text-ink"
        >
          View {result.crop.name} in Items
        </Link>
        <button type="button" onClick={onBack} className="min-h-11 rounded-sm bg-sunken px-3 text-sm font-semibold">
          Replace again
        </button>
      </div>
    )
  }

  if (confirmCrop) {
    const quantity = inventory?.find((stack) => stack.itemId === confirmCrop.id)?.quantity ?? 0
    const sameStat = currentStat === confirmCrop.stat
    const delta = currentStat === null
      ? `${titleCase(confirmCrop.stat)} +${statPay}`
      : sameStat
        ? `Stats stay the same · ${titleCase(confirmCrop.stat)} +${statPay}`
        : `${titleCase(currentStat)} −${statPay} · ${titleCase(confirmCrop.stat)} +${statPay}`
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
          <CropMark crop={confirmCrop} size={58} />
          <div>
            <p className="font-display text-lg font-bold">Use {confirmCrop.name}?</p>
            <p className="flex items-center gap-1 text-[12px] text-ink-soft"><TypeIcon type={confirmCrop.stat} size={17} />{delta}</p>
          </div>
        </div>
        <p className="text-[12px] text-ink-soft">
          Consume 1 crop · inventory {quantity} → {Math.max(0, quantity - 1)}. Replacing Produce does not refund the crop already in this node.
        </p>
        <button
          type="button"
          disabled={busy || quantity <= 0}
          onClick={onConfirm}
          className="min-h-11 rounded-sm bg-accent px-3 text-sm font-bold text-ink disabled:opacity-40"
        >
          {busy ? 'Setting Produce…' : `Consume 1 ${confirmCrop.name}`}
        </button>
        <button type="button" disabled={busy} onClick={onBack} className="min-h-11 rounded-sm bg-sunken px-3 text-sm font-semibold">
          Back to crops
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {assignment && (
        <div className="flex min-h-11 items-center gap-2 rounded-sm bg-sunken px-3 py-2">
          {currentCrop ? <CropMark crop={currentCrop} size={36} /> : currentStat ? <TypeIcon type={currentStat} size={32} /> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{currentCrop?.name ?? `Legacy ${currentStat ? titleCase(currentStat) : 'Produce'}`}</span>
            <span className="text-micro">Current · {currentStat ? `${titleCase(currentStat)} +${statPay}` : 'no valid effect'}</span>
          </span>
        </div>
      )}
      <p className="text-[11px] text-ink-soft">
        Choose one crop grown for this scenario. A crop is consumed on first fill and every replacement; Produce cannot be removed for a refund.
      </p>
      {!persistent && <p className="rounded-sm bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">Produce needs local storage and is unavailable in memory-only mode.</p>}
      {persistent && inventory === null && <p className="py-4 text-center text-[12px] text-ink-soft">Reading Item inventory…</p>}
      {persistent && inventory?.map((stack) => {
        const crop = farmCropFor(tier, stack.itemId.split(':').at(-1) as StatKey)
        if (!crop || crop.id !== stack.itemId) return null
        return (
          <button
            key={crop.id}
            type="button"
            disabled={busy || stack.quantity <= 0}
            onClick={() => onChoose(crop)}
            className="flex min-h-[52px] items-center gap-3 rounded-sm bg-panel px-3 py-2 text-left disabled:opacity-40"
          >
            <CropMark crop={crop} size={42} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{crop.name}</span>
              <span className="flex items-center gap-1 text-micro"><TypeIcon type={crop.stat} size={15} />{titleCase(crop.stat)} +{statPay}</span>
            </span>
            <span className="text-sm font-bold">×{stack.quantity}</span>
          </button>
        )
      })}
      <p className="text-[10px] text-ink-faint">Only Tier {tier} crops fit this constellation. Out-of-stock crops stay visible but cannot be selected.</p>
    </div>
  )
}

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
