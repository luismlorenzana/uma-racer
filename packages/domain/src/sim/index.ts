// `@racer/domain/sim`: the loop simulation (D348, docs/game/12-economy-and-pacing.md
// §12): synthetic content, the owner's policies, the committed win table, the run, its report and its checks, and the
// representative deck's demand over a tier. `scripts/sim/loop.ts` prints it; the tests and the live blocks read it.
export * from './clock'
export * from './fixtures'
export * from './build'
export * from './places'
export * from './win-table'
export * from './policies'
export * from './metrics'
export * from './loop'
export * from './demand'
export * from './probes'
export * from './checks'
export * from './report'
