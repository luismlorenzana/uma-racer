// The stage registry (docs/game/07-stages.md §1, D384): every game's rules, by kind. A game registers here, at this
// module's load, so whatever reads the registry reads every game (a bundler can't drop a registration it would never
// see used). Adding a game is one import and one `registerStage` line below.
import type { AnyStageRules, StageKind, StageRules } from './contract'
import { FURLONG_RULES } from './furlong'
import { YARD_RULES } from './yard'

const REGISTRY = new Map<StageKind, AnyStageRules>()

/** Adds a game's rules; a kind registers once. */
export function registerStage<S>(rules: StageRules<S>): StageRules<S> {
  if (REGISTRY.has(rules.kind)) throw new Error(`The stage "${rules.kind}" is registered twice`)
  REGISTRY.set(rules.kind, rules)
  return rules
}

/** A game's rules, or null while it isn't built. */
export const stageRules = (kind: StageKind): AnyStageRules | null => REGISTRY.get(kind) ?? null

/** The kinds with rules, in registration order. */
export const registeredStages = (): StageKind[] => [...REGISTRY.keys()]

registerStage(YARD_RULES)
registerStage(FURLONG_RULES)
