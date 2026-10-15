// `@racer/domain/hub`: the Hub's place registry and its view of the account (docs/rework/11-hub-and-places.md, T137).
// `places.ts` and `words.ts` are cheap (the shell's entry chunk reads them); `view.ts` runs the rework rules and is
// read by the lazily loaded game chunk.
export * from './places'
export * from './view'
export * from './words'
