// Once-account drops and frozen-entrant EXP; caller replays/deduplicates (docs/design/uma-puzzles.md §7).
import { SCENARIOS } from '../../../scenarios'
import { parsePuzzleBattleState } from '../battle-parse'
import type { PuzzleBattleStateV1 } from '../battle-types'
import { puzzleMaterialId, type PuzzleScenarioRegistry } from '../materials'
import { puzzleBattleExp } from '../progression'
import { requirePuzzle } from '../validation'
import { puzzleEncounterRewards, puzzleFrozenNode } from './encounters'
import { parsePuzzleCampaignId, puzzleCampaignId } from './identity'
import type { PuzzleClearFact, PuzzleDarkVariant } from './types'

/** A parsed state is not proof of play: T110 must supply the state reconstructed from its accepted journal. */
export function puzzleBattleGrants(value: PuzzleBattleStateV1, registry: PuzzleScenarioRegistry = SCENARIOS) {
  const state = parsePuzzleBattleState(value, registry)
  requirePuzzle(state && state.outcome !== 'active', 'invalid', 'Battle must be terminal')
  const input = state.input, identity = parsePuzzleCampaignId(input.battleId, registry)
  requirePuzzle(identity && identity.kind === 'battle' && identity.partyId === input.partyId && identity.scenarioId === input.scenarioId &&
    input.checkpointId === puzzleCampaignId({ kind: 'checkpoint', partyId: identity.partyId, scenarioId: identity.scenarioId }, registry),
  'invalid', 'Battle is not a canonical campaign attempt')
  // Settled under the campaign version it was frozen with (D301).
  const frozen = puzzleFrozenNode(input, registry)
  requirePuzzle(frozen, 'invalid', 'Frozen encounter does not match chapter')
  const { node, version } = frozen
  requirePuzzle(input.kind === node.kind && input.encounterLevel === node.level, 'invalid', 'Frozen encounter does not match chapter')
  const variant = node.localId === 'c-dark' && input.rewards.length === 1 ? input.rewards[0]!.style as PuzzleDarkVariant : null
  const expected = puzzleEncounterRewards(node, variant, version)
  requirePuzzle(expected.length === input.rewards.length && expected.every((r, i) => r.style === input.rewards[i]!.style &&
    r.quantity === input.rewards[i]!.quantity), 'invalid', 'Frozen reward vector does not match authored node')
  const fact: PuzzleClearFact = { schemaVersion: 1, battleId: input.battleId, partyId: identity.partyId, scenarioId: identity.scenarioId,
    nodeId: node.id, attempt: identity.attempt, outcome: state.outcome }
  const outcome = fact.outcome
  return { fact, materials: state.outcome === 'win' ? expected.map(r => ({ itemId: puzzleMaterialId(input.scenarioId, r.style, registry), ...r })) : [],
    exp: input.entrants.map(e => ({ outfitId: e.outfitId, frozenLevel: e.level,
      amount: puzzleBattleExp(outcome, input.encounterLevel, e.level, input.kind, version) })) }
}
