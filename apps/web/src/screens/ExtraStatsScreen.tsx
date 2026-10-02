// The Extra stats grid: 20 stat nodes a scenario, bought with its Farm crops, any six on (D235,
// docs/design/constellations.md#extra-stats).

import {
  EXTRA_STAT_NODES_PER_STAT,
  EXTRA_STAT_NODE_VALUE,
  EXTRA_STAT_SLOTS,
  STATS,
  buffedStatNodeValue,
  extraStatNodeId,
  extraStatUnlockCost,
  farmCropFor,
  parseExtraStatNodeId,
  scenarioBuff,
  type ExtraStatNodeId,
  type InventoryStackData,
  type StatKey,
} from '@racer/domain'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listProduceInventory, setExtraStatActive, unlockExtraStat } from '../game/actions'
import { useGame } from '../game/store'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CropMark } from '../ui/farm/CropMark'
import { LockedIcon } from '../ui/icons'
import { TYPE_ICON_COLORS, TypeIcon, typeLabel } from '../ui/TypeIcon'
import { useTraining } from './TrainingScene'

export type NodeState = 'on' | 'off' | 'next' | 'locked'

export function ExtraStatsScreen() {
  const { save, uma } = useTraining()
  const pushToast = useGame((state) => state.pushToast)
  const persistent = useGame((state) => state.persistent)
  const [inventory, setInventory] = useState<InventoryStackData[] | null>(null)
  const [buying, setBuying] = useState<ExtraStatNodeId | null>(null)
  const [busy, setBusy] = useState(false)
  const { run } = uma
  const extra = run.extraStats
  const pay = buffedStatNodeValue(run.tier, EXTRA_STAT_NODE_VALUE)
  const buff = scenarioBuff(run.tier)
  const slotsFull = extra.active.length >= EXTRA_STAT_SLOTS

  useEffect(() => {
    if (!persistent) return
    let active = true
    setInventory(null)
    void listProduceInventory(run.tier).then((stacks) => { if (active) setInventory(stacks) })
      .catch((reason) => { if (active) pushToast(reason instanceof Error ? reason.message : 'Could not read the Farm crops') })
    return () => { active = false }
  }, [persistent, pushToast, run.tier])

  const quantity = (stat: StatKey): number => inventory?.find((stack) => stack.itemId === farmCropFor(run.tier, stat)?.id)?.quantity ?? 0
  const stateOf = (stat: StatKey, index: number): NodeState => {
    const owned = extra.unlocked[stat]
    if (index <= owned) return extra.active.includes(extraStatNodeId(stat, index)) ? 'on' : 'off'
    return index === owned + 1 ? 'next' : 'locked'
  }

  const toggle = async (nodeId: ExtraStatNodeId, on: boolean) => {
    if (busy) return
    if (on && slotsFull) {
      pushToast(`All ${EXTRA_STAT_SLOTS} slots are on. Turn one off first.`)
      return
    }
    setBusy(true)
    try {
      await setExtraStatActive(save.templateId, run.tier, nodeId, on)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not change that node')
    } finally {
      setBusy(false)
    }
  }

  const buy = async () => {
    if (!buying || busy) return
    setBusy(true)
    try {
      const receipt = await unlockExtraStat({ umaId: save.templateId, tier: run.tier, nodeId: buying })
      const node = parseExtraStatNodeId(buying)!
      const cropId = farmCropFor(run.tier, node.stat)?.id
      setInventory((current) => current?.map((stack) => stack.itemId === cropId ? { ...stack, quantity: receipt.quantityAfter } : stack) ?? null)
      setBuying(null)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not buy that node')
      try { setInventory(await listProduceInventory(run.tier)) } catch { /* The original error is the actionable one. */ }
    } finally {
      setBusy(false)
    }
  }

  const buyingNode = buying ? parseExtraStatNodeId(buying) : null
  const buyingCrop = buyingNode ? farmCropFor(run.tier, buyingNode.stat) : null
  const buyingCost = buyingNode ? extraStatUnlockCost(buyingNode.index) : 0
  const buyingHave = buyingNode ? quantity(buyingNode.stat) : 0

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-safe">
        <p className="rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">
          Buy nodes with this scenario's Farm crops, once and for good. Any {EXTRA_STAT_SLOTS} can be on, each paying +{pay} to
          its stat, and you can switch them before any race. Training Level plays no part.
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 px-1" aria-label={`${extra.active.length} of ${EXTRA_STAT_SLOTS} slots on`}>
          <span className="text-[12px] font-semibold">Slots on <span className="text-ink-soft">· {extra.active.length} / {EXTRA_STAT_SLOTS}</span></span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: EXTRA_STAT_SLOTS }, (_, index) => {
              const id = extra.active[index]
              const stat = id ? parseExtraStatNodeId(id)!.stat : null
              return stat
                ? <TypeIcon key={index} type={stat} size={20} />
                : <span key={index} className="h-5 w-5 rounded-[6px] border border-dashed border-hairline-strong" />
            })}
          </span>
        </div>

        <div className="mt-2 grid gap-1.5">
          {STATS.map((stat) => {
            const crop = farmCropFor(run.tier, stat)
            return (
              <div key={stat} className="flex items-center gap-2 rounded-md border border-hairline bg-panel p-2 shadow-1">
                <div className="w-[78px] shrink-0">
                  <span className="flex items-center gap-1 text-[13px] font-semibold"><TypeIcon type={stat} size={20} />{typeLabel(stat)}</span>
                  {crop && <span className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-soft">
                    <CropMark crop={crop} size={14} /><span className="truncate">{persistent && inventory ? `×${quantity(stat)}` : crop.name}</span>
                  </span>}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5">
                  {Array.from({ length: EXTRA_STAT_NODES_PER_STAT }, (_, offset) => {
                    const index = offset + 1
                    const nodeId = extraStatNodeId(stat, index)
                    return <NodeButton key={nodeId} stat={stat} index={index} state={stateOf(stat, index)} pay={pay}
                      cropName={crop?.name ?? ''} disabled={busy}
                      onPress={(state) => {
                        if (state === 'on') void toggle(nodeId, false)
                        else if (state === 'off') void toggle(nodeId, true)
                        else if (state === 'next') {
                          if (!persistent) pushToast('Buying Extra stats needs local storage')
                          else setBuying(nodeId)
                        }
                      }} />
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {buff.id === 'foundation' && (
          <p className="mt-2 rounded-md border border-accent/40 bg-accent-wash px-3 py-1.5 text-[12px]">
            <span className="font-semibold">{buff.name}</span> <span className="text-ink-soft">· {buff.rule}</span>
          </p>
        )}
        <p className="mt-2 px-1 pb-4 text-[11px] text-ink-faint">
          A stat's nodes cost 1, 2, 3 and 4 of its crop for scenario {run.tier}. Grow them on the <Link to="/farm" className="font-semibold text-accent-strong">Farm</Link>.
        </p>
      </div>

      <BottomSheet open={buying !== null} onClose={() => { if (!busy) setBuying(null) }}>
        {buyingNode && buyingCrop && (
          <div className="grid gap-3 px-1 pb-4">
            <h2 className="font-display text-xl font-bold">Buy {typeLabel(buyingNode.stat)} node {buyingNode.index}</h2>
            <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
              <CropMark crop={buyingCrop} size={56} />
              <div className="min-w-0">
                <p className="font-semibold">Consume {buyingCost} {buyingCrop.name}</p>
                <p className="text-[12px] text-ink-soft">You have {buyingHave}{buyingHave >= buyingCost ? ` → ${buyingHave - buyingCost}` : ''}</p>
              </div>
            </div>
            <p className="text-[12px] text-ink-soft">
              It stays in this scenario's grid for good and pays {typeLabel(buyingNode.stat)} +{pay} while it is on.
              {slotsFull ? ` All ${EXTRA_STAT_SLOTS} slots are on, so it starts off.` : ' It turns on at once.'} Crops are not refunded.
            </p>
            <Button disabled={busy || buyingHave < buyingCost} onClick={() => void buy()}>
              {busy ? 'Buying…' : `Consume ${buyingCost} ${buyingCrop.name}`}
            </Button>
            {buyingHave < buyingCost && (
              <Link to="/farm" className="text-center text-[13px] font-semibold text-accent-strong">
                Need {buyingCost - buyingHave} more · grow {buyingCrop.name} on the Farm
              </Link>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  )
}

export function NodeButton({ stat, index, state, pay, cropName, disabled, onPress }: {
  stat: StatKey
  index: number
  state: NodeState
  pay: number
  cropName: string
  disabled: boolean
  onPress: (state: NodeState) => void
}) {
  const colors = TYPE_ICON_COLORS[stat]
  const cost = extraStatUnlockCost(index)
  const label = state === 'on' ? `${typeLabel(stat)} node ${index}, on, +${pay}. Turn off`
    : state === 'off' ? `${typeLabel(stat)} node ${index}, off. Turn on`
      : state === 'next' ? `Buy ${typeLabel(stat)} node ${index} for ${cost} ${cropName}`
        : `${typeLabel(stat)} node ${index}, locked: buy node ${index - 1} first`
  const owned = state === 'on' || state === 'off'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={owned ? state === 'on' : undefined}
      disabled={disabled || state === 'locked'}
      onClick={() => onPress(state)}
      className={`flex aspect-square min-h-11 min-w-0 flex-col items-center justify-center rounded-sm border text-[10px] font-bold transition-transform active:scale-95 ${
        state === 'on' ? 'text-white shadow-1'
          : state === 'off' ? 'border-hairline-strong bg-sunken text-ink-soft'
            : state === 'next' ? 'border-dashed border-accent bg-panel text-accent-strong'
              : 'border-hairline bg-sunken/60 text-ink-faint'
      }`}
      style={state === 'on' ? { background: `linear-gradient(180deg, ${colors.top}, ${colors.bottom})`, borderColor: colors.rim } : undefined}
    >
      {state === 'on' && <><TypeIcon type={stat} size={20} /><span className="mt-0.5">+{pay}</span></>}
      {state === 'off' && <><span className="opacity-50"><TypeIcon type={stat} size={20} /></span><span className="mt-0.5">Off</span></>}
      {state === 'next' && <><span className="text-[15px] leading-none">+</span><span className="mt-1">×{cost}</span></>}
      {state === 'locked' && <><LockedIcon size={16} /><span className="mt-0.5">×{cost}</span></>}
    </button>
  )
}
