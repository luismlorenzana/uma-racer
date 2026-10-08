// A training page's small Load button (D288): brings this page of the preset over from the same preset one scenario
// earlier, once the page has nothing left to unlock. It confirms first, since it replaces the page.

import { cardNodeCap, presetCarrySource, scenarioForTier, type PresetCarryPage, type ScenarioTraining, type UmaSave } from '@racer/domain'
import { useState } from 'react'
import { loadPresetPage } from '../game/actions'
import { useGame } from '../game/store'
import { BottomSheet } from './BottomSheet'
import { DISTANCE_ICONS } from './CardFocusIcons'
import { LoadIcon } from './icons'
import { PresetBadge } from './PresetBadge'
import { RpgModalFocus } from './rpg/RpgModalFocus'

const WHAT: Readonly<Record<PresetCarryPage, string>> = { constellation: 'constellation', inspiration: 'lineage', skills: 'skills' }

function describe(page: PresetCarryPage, from: string, tier: number): string {
  if (page === 'constellation') {
    return `Replaces this preset's card set and card nodes with ${from}'s. Each card keeps its share of this tree; nodes past a card's cap of ${cardNodeCap(tier)} go to the set's other cards.`
  }
  if (page === 'inspiration') return `Replaces this preset's six lineage slots with ${from}'s. Unlocked slots and gold moons stay unlocked.`
  return `Replaces this preset's equipped skills with ${from}'s, in their order. Skills this library lacks, or past this scenario's SP, are skipped.`
}

export function PresetLoadButton({ save, run, page }: { save: UmaSave; run: ScenarioTraining; page: PresetCarryPage }) {
  const pushToast = useGame((state) => state.pushToast)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const from = presetCarrySource(save, run, page)
  if (!from) return null
  const name = scenarioForTier(from.tier)?.name ?? `Tier ${from.tier}`
  const source = `${name} · ${DISTANCE_ICONS[run.preset].label}`
  const load = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { skipped } = await loadPresetPage(save.templateId, page, run.tier, run.preset)
      setOpen(false)
      pushToast(`Loaded ${source} ${WHAT[page]}${skipped ? ` · ${skipped} skill${skipped === 1 ? '' : 's'} skipped` : ''}`)
    } catch (error) { pushToast(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" aria-label={`Load ${WHAT[page]} from ${name}`} onClick={() => setOpen(true)}
        className="-my-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center text-accent-strong">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-panel shadow-1"><LoadIcon size={16} /></span>
      </button>
      {open && <RpgModalFocus onClose={() => setOpen(false)}><BottomSheet open onClose={() => setOpen(false)}>
        <div className="space-y-3 pb-safe">
          <div className="flex items-center gap-2"><LoadIcon size={24} /><PresetBadge preset={run.preset} /></div>
          <h2 className="font-display text-xl">Load {name}'s {WHAT[page]}?</h2>
          <p className="text-sm text-ink-soft">{describe(page, source, run.tier)}</p>
          <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 w-full rounded-sm bg-accent px-3 font-semibold">
            {busy ? 'Loading…' : `Load from ${name}`}
          </button>
        </div>
      </BottomSheet></RpgModalFocus>}
    </>
  )
}
