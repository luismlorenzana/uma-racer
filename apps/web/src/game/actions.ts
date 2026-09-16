// Lazy gameplay mutations keep persistence/sync code out of the startup bundle.

export async function setFeaturedUma(id: string): Promise<void> {
  const { gameRuntime } = await import('./runtime')
  await gameRuntime.setFeaturedUma(id)
}
