// Lazy gameplay mutations keep persistence/sync code out of the startup bundle.

import { criticalGameplayAction } from '../app/update-lifecycle'

export async function setFeaturedUma(id: string): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setFeaturedUma(id)
}

export async function setConstellationNode(
  id: string,
  nodeId: string,
  assignment: import('@racer/domain').NodeAssignment | null,
  tier?: number,
) {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setConstellationNode(id, nodeId, assignment, tier)
}

export async function setUmaLoadout(id: string, skillIds: readonly string[], tier?: number): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaLoadout(id, skillIds, tier)
}

export async function setUmaDeck(id: string, orderedCardIds: readonly string[], tier?: number): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaDeck(id, orderedCardIds, undefined, tier)
}

export async function prepareRace(
  umaId: string,
  raceId: string,
  strategy: import('@racer/domain').Strategy,
  sequence?: number,
  tier?: number,
) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.prepareRace(umaId, raceId, strategy, sequence, tier)
}

export async function completeRace(attempt: import('./racing').PreparedRace) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.completeRace(attempt)
  })
}

export async function advanceUma(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.advanceUma(id)
  })
}

export async function startScenario(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.startScenario(id)
  })
}

export async function listLatestRaceTimes() {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listLatestRaceTimes()
}

export async function listUmaRaceHistory(umaId: string) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listUmaRaceHistory(umaId)
}

export async function listRaceHistory(limit = 20) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listRaceHistory(limit)
}

export async function grantDevResources(grant: import('./collection').DevGrant) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.grantDevResources(grant)
  })
}

export async function exchangeUmaShards() {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.exchangeUmaShards()
}

/** Owns a card with a Card Select Coupon, the only way to unlock one (D198). */
export async function unlockCard(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.unlockCard(id)
  })
}

export async function redeemUmaCoupon(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.redeemUmaCoupon(id)
  })
}

export async function saveBadgePreferences(id: string, preferences: import('@racer/domain').BadgePreferences | import('@racer/domain').TrainerBadgePreferences) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.saveBadgePreferences(id, preferences)
}

export async function listFlairTimeline(
  umaId: string,
  before: import('./badge-preferences').FlairTimelineCursor | null = null,
  kind: import('@racer/domain').FlairEventKind | null = null,
  limit = 30,
) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listFlairTimeline(umaId, before, kind, limit)
}
