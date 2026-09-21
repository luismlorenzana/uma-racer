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
) {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setConstellationNode(id, nodeId, assignment)
}

export async function setUmaLoadout(id: string, skillIds: readonly string[]): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaLoadout(id, skillIds)
}

export async function setUmaDeck(id: string, orderedCardIds: readonly string[]): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaDeck(id, orderedCardIds)
}

export async function prepareRace(
  umaId: string,
  raceId: string,
  strategy: import('@racer/domain').Strategy,
  sequence?: number,
) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.prepareRace(umaId, raceId, strategy, sequence)
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

export async function listRaceHistory(limit = 20) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listRaceHistory(limit)
}

export async function promoteSupportCard(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.promoteCard(id)
  })
}

export async function exchangeUmaShards() {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.exchangeUmaShards()
}

export async function redeemCardCoupon(id: string) {
  return criticalGameplayAction(async () => {
    const { gameRuntime } = await import('./runtime')
    return gameRuntime.redeemCardCoupon(id)
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
