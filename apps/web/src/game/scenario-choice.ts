// Which of her trained units an Uma uses on this device (D190, docs/design/training.md#trained-units). Device-local and
// never synced. A choice is remembered with the scenario that was current when it was made, so advancing her returns
// her to her new scenario rather than to an old one.

import type { UmaSave } from '@racer/domain'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'uma-racer:scenario-choice'

interface Choice {
  tier: number
  /** Her current scenario when the choice was made. */
  current: number
}

type Choices = Readonly<Record<string, Choice>>

const EMPTY: Choices = {}
let cache: Choices | null = null
const listeners = new Set<() => void>()

const isTier = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 1

function load(): Choices {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}')
    const entries = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.entries(parsed) : []
    cache = Object.fromEntries(entries.filter(([, value]) =>
      value && typeof value === 'object' && isTier((value as Choice).tier) && isTier((value as Choice).current)))
  } catch {
    cache = EMPTY
  }
  return cache
}

function store(next: Choices) {
  cache = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // A blocked store only means the choice lasts until reload.
  }
  for (const listener of listeners) listener()
}

type Unit = Pick<UmaSave, 'templateId' | 'unlockedTier' | 'scenarios'>

/** The scenario she uses: the one chosen for her, while it is still one of hers and her current one has not moved. */
export function chosenTier(uma: Unit, choices: Choices = load()): number {
  const choice = choices[uma.templateId]
  return choice && choice.current === uma.unlockedTier && uma.scenarios.some((run) => run.tier === choice.tier)
    ? choice.tier
    : uma.unlockedTier
}

export function chooseTier(uma: Unit, tier: number): void {
  const next = { ...load() }
  if (tier === uma.unlockedTier || !uma.scenarios.some((run) => run.tier === tier)) delete next[uma.templateId]
  else next[uma.templateId] = { tier, current: uma.unlockedTier }
  store(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Her scenario in use, kept in step with every screen that changes it; null without an Uma. */
export function useChosenTier(uma: Unit | undefined): number | null {
  const choices = useSyncExternalStore(subscribe, load, () => EMPTY)
  return uma ? chosenTier(uma, choices) : null
}

/** Test seam: forget the in-memory copy so the next read goes back to storage. */
export function resetScenarioChoiceCache(): void {
  cache = null
}
