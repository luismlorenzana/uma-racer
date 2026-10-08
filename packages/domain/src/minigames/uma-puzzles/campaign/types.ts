// Pure checkpoint/map projections, not save fields (docs/technical/uma-puzzles-implementation.md §§2–5).
import type { Strategy } from '../../../types'
import type { PuzzleBattleKind, PuzzleEnemy } from '../battle-types'
import type { PuzzleElement } from '../types'
import type { PuzzleFoeRole } from './rules'

export type PuzzleDarkVariant = 'pace' | 'late'
export interface PuzzleMapNode { id: string; localId: string; row: number; column: number; sector: number;
  kind: PuzzleBattleKind; level: number; elements: PuzzleElement[]; roles: PuzzleFoeRole[];
  darkStyle: PuzzleDarkVariant | null; exits: string[]; requires: string[][] }
export interface PuzzleChapter { schemaVersion: 1; id: string; scenarioId: string; tier: number; name: string;
  levelStart: number; levelEnd: number; nodes: PuzzleMapNode[] }
export interface PuzzleCheckpointV1 { schemaVersion: 1; chapterId: string; partyId: string;
  cleared: string[]; attempts: { nodeId: string; next: number }[] }
/** Private runtime supplies only verified cast ids and matching tags; display names/art live outside rules. */
export interface PuzzleCastV1 { schemaVersion: 1; manifestVersion: string;
  members: { id: string; elements: PuzzleElement[]; roles: PuzzleFoeRole[] }[] }
export interface PuzzleEncounter { nodeId: string; level: number; kind: PuzzleBattleKind; enemies: PuzzleEnemy[];
  rewards: { style: Strategy; quantity: number }[]; darkVariant: PuzzleDarkVariant | null }
export interface PuzzleClearFact { schemaVersion: 1; battleId: string; partyId: string; scenarioId: string;
  nodeId: string; attempt: number; outcome: 'win' | 'loss' | 'abandon' }
