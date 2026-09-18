// Lazy gameplay mutations keep persistence/sync code out of the startup bundle.

export async function setFeaturedUma(id: string): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setFeaturedUma(id)
}

export async function setUmaLoadout(id: string, skillIds: readonly string[]): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaLoadout(id, skillIds)
}

export async function setUmaDeck(id: string, orderedCardIds: readonly string[]): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setUmaDeck(id, orderedCardIds)
}

export async function trainUma(id: string, facility: import('@racer/domain').Facility) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.trainUma(id, facility)
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
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.completeRace(attempt)
}

export async function promoteUma(id: string) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.promoteUma(id)
}

export async function startScenario(id: string, selection: import('@racer/domain').ScenarioStartSelection) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.startScenario(id, selection)
}

export async function listRaceHistory(limit = 20) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.listRaceHistory(limit)
}

export async function promoteSupportCard(id: string) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.promoteCard(id)
}

export async function exchangeUmaShards() {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.exchangeUmaShards()
}

export async function redeemCardCoupon(id: string) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.redeemCardCoupon(id)
}

export async function redeemUmaCoupon(id: string) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.redeemUmaCoupon(id)
}
