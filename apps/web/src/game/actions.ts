// Lazy gameplay mutations keep persistence/sync code out of the startup bundle.

export async function setFeaturedUma(id: string): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setFeaturedUma(id)
}

export async function ensureTrainingDeck(id: string): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.ensureTrainingDeck(id)
}

export async function trainUma(id: string, facility: import('@racer/domain').Facility) {
  const { gameRuntime } = await import('./runtime')
  return gameRuntime.trainUma(id, facility)
}
