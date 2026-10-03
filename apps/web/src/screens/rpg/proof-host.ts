// DEV/TEST ONLY. Invented encounter + separate Dexie journal; no account save, sync, EXP or Item writes.
import Dexie, { type Table } from 'dexie'
import { applyAction, replay, type CombatAction, type EncounterInput, type RpgCheckpointSaveV1 } from '@racer/domain'
import { syntheticAlly, syntheticEnemy } from '../../../../../packages/domain/src/rpg/combat/synthetic'
import type { RpgBattleHost, RpgBattleView } from '../../game/rpg-battle-host'

export type ProofMode = 'practice' | 'boss' | 'loss'
interface ProofRow { id: string; input: EncounterInput; actions: CombatAction[]; hash: string; accepted: boolean; abandoned: boolean; retries: number }
export const proofCheckpoint: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId: 'party-1', chapterId: 'invented-proof',
  contentVersion: 'synthetic-v1', contentHash: 'a'.repeat(64), attemptIndex: 1, attemptId: 'rpg-attempt:party-1:invented-proof:1',
  lastClearedNodeId: null, selectedPath: [], status: 'in-battle', revision: 0, frozenEntry: null }

export function proofEncounter(mode: ProofMode): EncounterInput {
  const allies = [syntheticAlly(0, 'greatsword', 'fire'), syntheticAlly(1, 'spear', 'ice'),
    syntheticAlly(2, 'sword-shield', 'light'), syntheticAlly(3, 'cleric-staff', 'light'),
    syntheticAlly(4, 'tome', 'lightning')]
  const boss = syntheticEnemy('proof-captain', 'ice', true)
  const enemies = mode === 'practice' ? [syntheticEnemy('proof-scout', 'ice'), syntheticEnemy('proof-mage', 'fire')]
    : [{ ...boss, stats: { ...boss.stats, hp: mode === 'loss' ? 9_000 : 1_100,
      atk: mode === 'loss' ? 2_000 : boss.stats.atk, matk: mode === 'loss' ? 2_000 : boss.stats.matk } }]
  return { version: 1, contentVersion: 'synthetic-v1', seed: 94, allies, enemies, weaknessFollowUp: 'bounded' }
}

/** Exercises the exact reducer and optimistic action count, but cannot enqueue an account command. */
export class ProofBattleHost implements RpgBattleHost {
  private database: Dexie & { runs: Table<ProofRow, string> }
  constructor(private mode: ProofMode, databaseName = 'uma-rpg-battle-proof-v1') {
    this.database = new Dexie(databaseName) as Dexie & { runs: Table<ProofRow, string> }
    this.database.version(1).stores({ runs: '&id' })
  }
  private async row(): Promise<ProofRow> {
    const stored = await this.database.runs.get(this.mode)
    if (stored) return stored
    return this.database.transaction('rw', this.database.runs, async () => {
      const current = await this.database.runs.get(this.mode)
      if (current) return current
      const input = proofEncounter(this.mode)
      const row: ProofRow = { id: this.mode, input, actions: [], hash: replay(input, []).hash,
        accepted: false, abandoned: false, retries: 0 }
      await this.database.runs.put(row)
      return row
    })
  }
  async resume(_id: string): Promise<RpgBattleView> {
    const row = await this.row()
    const step = replay(row.input, row.actions)
    if (step.error || step.hash !== row.hash) throw new Error('Proof journal hash mismatch; clear only the development proof database')
    const last = row.actions.at(-1)
    const cueState = last ? replay(row.input, row.actions.slice(0, -1)).state : null
    const cues = last && cueState ? applyAction(cueState, last).cues : []
    const common = { checkpoint: { ...proofCheckpoint, revision: row.retries }, state: step.state,
      actionCount: row.actions.length, cues, lastAction: last ?? null, cueState, evidence: null }
    if (row.accepted) return { ...common, kind: 'accepted', resultId: `proof-result-${row.retries}`,
      outcome: row.abandoned || step.state.outcome === 'loss' ? 'loss' : 'win' }
    return step.state.outcome === 'active' ? { ...common, kind: 'open', recovery: 'none' }
      : { ...common, kind: 'pending', phase: 'result' }
  }
  async enter(_uid: string, id: string, _node: string): Promise<RpgBattleView> {
    const row = await this.row()
    if (row.accepted && (row.abandoned || replay(row.input, row.actions).state.outcome === 'loss')) {
      await this.database.runs.put({ ...row, actions: [], hash: replay(row.input, []).hash,
        accepted: false, abandoned: false, retries: row.retries + 1 })
    }
    return this.resume(id)
  }
  async submitAction(id: string, expected: number, action: CombatAction): Promise<RpgBattleView> {
    await this.row()
    await this.database.transaction('rw', this.database.runs, async () => {
      const row = (await this.database.runs.get(this.mode))!
      if (row.accepted || row.actions.length !== expected) throw new Error('Battle action count is stale')
      const before = replay(row.input, row.actions)
      if (before.error || before.hash !== row.hash) throw new Error('Proof replay differs from its hash')
      const applied = applyAction(before.state, action)
      if (applied.error) throw new Error(`Illegal RPG action: ${applied.error}`)
      await this.database.runs.put({ ...row, actions: [...row.actions, action], hash: applied.hash })
    })
    return this.resume(id)
  }
  async complete(id: string): Promise<RpgBattleView> {
    const row = await this.row()
    if (replay(row.input, row.actions).state.outcome === 'active') throw new Error('Battle is not terminal')
    await this.database.runs.put({ ...row, accepted: true })
    return this.resume(id)
  }
  async abandonToCheckpoint(id: string): Promise<RpgBattleView> {
    const row = await this.row()
    await this.database.runs.put({ ...row, accepted: true, abandoned: true })
    return this.resume(id)
  }
  async restartFromFrozenEntry(_id: string): Promise<RpgBattleView> { throw new Error('Proof recovery is unavailable') }
  async takeover(_id: string): Promise<RpgBattleView> { throw new Error('Proof has no cross-device account lease') }
  async reset(id: string): Promise<RpgBattleView> { await this.database.runs.delete(this.mode); return this.resume(id) }
  close() { this.database.close() }
}
