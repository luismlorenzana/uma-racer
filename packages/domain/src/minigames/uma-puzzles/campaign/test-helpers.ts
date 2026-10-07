// Invented accepted-ledger fixtures only; never a production settlement shortcut.
import { puzzleCampaignId } from './identity'
import { createPuzzleCheckpoint, applyPuzzleTerminal } from './progress'
import type { PuzzleChapter, PuzzleCheckpointV1, PuzzleClearFact } from './types'
export const acceptedFact = (chapter: PuzzleChapter, progress: PuzzleCheckpointV1, localId: string,
  outcome: PuzzleClearFact['outcome'] = 'win'): PuzzleClearFact => {
  const nodeId = puzzleCampaignId({ kind: 'node', scenarioId: chapter.scenarioId, localId })
  const attempt = progress.attempts.find(a => a.nodeId === nodeId)?.next ?? 0
  return { schemaVersion: 1, battleId: puzzleCampaignId({ kind: 'battle', scenarioId: chapter.scenarioId, localId, partyId: progress.partyId, attempt }),
    partyId: progress.partyId, scenarioId: chapter.scenarioId, nodeId, attempt, outcome }
}
export function reachedFinals(chapter: PuzzleChapter) {
  let progress = createPuzzleCheckpoint(chapter, 'puzzle-party-1')
  for (const n of chapter.nodes.filter(n => n.kind === 'guardian' || n.localId.endsWith('a')))
    progress = applyPuzzleTerminal(chapter, progress, acceptedFact(chapter, progress, n.localId))
  return progress
}
