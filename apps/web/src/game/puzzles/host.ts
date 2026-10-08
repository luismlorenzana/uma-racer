// Real local-first port; no screens or installed double (docs/technical/uma-puzzles-implementation.md §§4–7).
import { PUZZLE_PARTY_IDS, SCENARIOS, STATS, TRAINING_LEVEL_UP_TICKET_ID, applyPuzzleBattleAction,
  constellationTemplate, createPuzzleBattle, createPuzzleCheckpoint, deriveUma, eligiblePuzzleElements,
  eligiblePuzzleStyles, freezePuzzleEncounter, nodesUnlockedBetween, parseConstellationBankSave, parseInventoryStackData,
  parsePuzzleCampaignId, parsePuzzleCheckpointSave, parsePuzzleOperationReceipt, parsePuzzleOutfitSave,
  parsePuzzlePresetSave, parsePuzzleResultSave, parsePuzzleTakeoverResponse, parseSaveSnapshot, parseUmaSaveOrThrow,
  puzzleBattleResult, puzzleBattleStateHash, puzzleCampaignId, puzzleCanonical, puzzlePayloadHash,
  puzzleReadiness, puzzleStats, puzzleChapter, replayPuzzleBattle, type ConstellationBankSaveV1, type PuzzleBattleAction,
  type PuzzleBattleStateV1, type PuzzleBattleTransition, type PuzzleCastV1, type PuzzleCheckpointSaveV1,
  type PuzzleDarkVariant, type PuzzleElement, type PuzzleKit, type PuzzleMaterialInput, type PuzzleOpenEncounterV1,
  type PuzzleOperationReceiptV1, type PuzzleOutfitSaveV1, type PuzzlePackIdentity, type PuzzlePayload,
  type PuzzlePresetSaveV1, type PuzzleResultSaveV1, type PuzzleSourceV1, type PuzzleTakeoverRequest, type Stats,
  type UmaSave } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import type { PuzzlePresentationLease } from '../../content/puzzles'
import { RacerDb, type PuzzleJournalRow } from '../db'
import { PUZZLES_RELEASE_ENABLED } from './capability'
import { PuzzleOperationCoordinator, puzzleTransactionTables } from './operations'
import { PuzzleRecoveryError, replayPuzzleJournal, parsePuzzleJournal } from './journal'
import { puzzleCombatSummary, type PuzzleCombatSummary } from './battle-presentation'
import { reconcilePuzzleFlairInTransaction } from './flair'

export interface PuzzleCastLease {
  identity: PuzzlePackIdentity; cast: PuzzleCastV1; release(): void
  /** Real presentation supplied by the verified content library; absent only in isolated proofs. */
  presentation?: PuzzlePresentationLease
}
export interface PuzzleHostOptions {
  database: RacerDb; deviceId: string
  source(outfitId: string): PuzzleSourceV1
  acquire(identity?: PuzzlePackIdentity): Promise<PuzzleCastLease>
  schedule(): void; publish?(): Promise<void>; content?: LoadedContent
  /** Never selected by a URL. Only separate synthetic stores inject true before release. */
  enabled?: boolean; now?: () => number; afterWrite?: (boundary: string) => void
  online?: {
    available(): boolean; flush(): Promise<void>
    takeover(request: PuzzleTakeoverRequest): Promise<unknown>
    snapshot(): Promise<unknown>
  }
}
export interface PuzzleAccount {
  readiness: ReturnType<typeof puzzleReadiness>; bank: ConstellationBankSaveV1 | null
  outfits: readonly PuzzleOutfitSaveV1[]; parties: readonly PuzzlePresetSaveV1[]
  checkpoints: readonly PuzzleCheckpointSaveV1[]; stocks: Readonly<Record<string, number>>
  /** Read-only racing units and durable material-operation status; never a second inventory. */
  umas: readonly UmaSave[]
  materialOperations: readonly { id: string; status: 'pending' | 'accepted' | 'rejected' | 'blocked'; reason: string | null }[]
}
export interface PuzzleBattleView {
  kind: 'battle'; open: PuzzleOpenEncounterV1; state: PuzzleBattleStateV1; actions: readonly PuzzleBattleAction[]
  stateHash: string; lastStep: PuzzleBattleTransition | null; lease: PuzzleCastLease
}
export interface PuzzleResultView { kind: 'result'; receipt: PuzzleResultSaveV1; pending: boolean; summary?: PuzzleCombatSummary | null }
export interface PuzzleRecoveryView {
  kind: 'recovery'; code: PuzzleRecoveryError['code']; message: string; open: PuzzleOpenEncounterV1 | null
}
export type PuzzleLoadedBattle = PuzzleBattleView | PuzzleResultView | PuzzleRecoveryView
/** Screens depend on the port, not its transaction coordinator or Dexie options. */
export type PuzzleHost = Pick<PersistentPuzzleHost, 'account' | 'registration' | 'enroll' | 'correct' | 'equip' | 'saveParty' |
  'transfer' | 'openChapter' | 'begin' | 'loadBattle' | 'append' | 'commit' | 'previewCl' | 'previewExchange' | 'confirmMaterial' | 'takeover'>
export interface PuzzleCommitClaim { battleId: string; ownerEpoch: number; expectedCount: number; stateHash: string }
export interface PuzzleMaterialPreview {
  payload: Extract<PuzzlePayload, { kind: 'cl-spend' | 'exchange' }>
  /** Full economic comparison, not a hash-only authorization. */
  confirmation: string; revision: number; stocks: Readonly<Record<string, number>>
  receipt: PuzzleOperationReceiptV1
}
export interface PuzzleClResult {
  outfitId: string; scenarioId: string; before: number; after: number; spOnly: boolean
  nodes: { id: string; label: string }[]; delta: { stats: Stats; skillPoints: number } | null
  href: string
}
const failure = (code: PuzzleRecoveryError['code'], message: string): never => { throw new PuzzleRecoveryError(code, message) }
const checked = <T>(value: T | null, label: string): T => value ?? failure('conflict', `Invalid saved ${label}; it was retained for recovery.`)
export const emptyPuzzleParty = (partyId: string): PuzzlePresetSaveV1 => checked(parsePuzzlePresetSave({
  schemaVersion: 1, partyId, name: `Party ${PUZZLE_PARTY_IDS.indexOf(partyId as never) + 1}`, slots: [null, null, null, null, null],
  leaderId: 'puzzle:combo-leader', foregroundChapter: null, revision: 0,
}), 'party identity')

export class PersistentPuzzleHost {
  readonly coordinator: PuzzleOperationCoordinator
  private readonly database: RacerDb
  private readonly enabled: boolean
  private readonly now: () => number
  private readonly wrote: (boundary: string) => void
  constructor(private readonly options: PuzzleHostOptions) {
    if (!/^[a-zA-Z0-9:._-]{1,120}$/.test(options.deviceId)) throw new Error('Invalid Puzzle device identity')
    this.database = options.database; this.enabled = options.enabled ?? PUZZLES_RELEASE_ENABLED
    this.now = options.now ?? Date.now; this.wrote = options.afterWrite ?? (() => {})
    this.coordinator = new PuzzleOperationCoordinator(this.database, '', options.schedule, this.enabled, this.wrote)
  }
  private tables() { return [...puzzleTransactionTables(this.database), ...['badges', 'cards', 'ledger', 'raceResults', 'flairEvents'].map(k => this.database.table(k))] }
  private async guard(): Promise<ConstellationBankSaveV1> {
    if (!this.enabled) return failure('disabled', 'Uma Puzzles is not enabled. Current training remains available.')
    const row = await this.database.constellationBank.get('main')
    const bank = row ? checked(parseConstellationBankSave(row.data), 'Constellation bank') : null
    if (bank?.phase !== 'active') return failure('preparing', 'Constellation preservation is not ready. Retry preparation or return to another mode.')
    return bank
  }
  private async afterCommit() { await this.options.publish?.(); await this.coordinator.afterCommit() }
  private async dependencies(operationId: string): Promise<string[]> {
    const existing = (await this.database.pendingPuzzleOperations.get(operationId))?.operation ??
      (await this.database.puzzleOperations.get(operationId))?.data.operation
    if (existing) return [...existing.dependencies]
    const latest = (await this.database.pendingPuzzleOperations.orderBy('order').toArray()).filter(p => p.status === 'pending').at(-1)
    return latest ? [latest.id] : []
  }
  private async receipt(operationId: string): Promise<PuzzleOperationReceiptV1 | null> {
    const accepted = await this.database.puzzleOperations.get(operationId)
    if (accepted) return checked(parsePuzzleOperationReceipt(accepted.data), 'operation receipt')
    const pending = await this.database.pendingPuzzleOperations.get(operationId)
    if (!pending) return null
    if (pending.status !== 'pending') return failure('conflict', pending.reason ?? 'This operation requires review; it was not resubmitted.')
    return checked(parsePuzzleOperationReceipt(pending.prediction), 'predicted receipt')
  }
  private async enqueue(payload: PuzzlePayload, operationId: string): Promise<PuzzleOperationReceiptV1> {
    const prior = await this.receipt(operationId)
    if (prior && puzzleCanonical(prior.operation.payload) !== puzzleCanonical(payload))
      return failure('conflict', 'Operation id was reused with a different input.')
    await this.coordinator.enqueueInTransaction(payload, operationId, await this.dependencies(operationId), this.now())
    return checked(await this.receipt(operationId), 'durable operation')
  }
  private async mutation(payload: PuzzlePayload, operationId: string, validate?: () => Promise<void>) {
    const detached = structuredClone(payload)
    const receipt = await this.database.transaction('rw', this.tables(), async () => {
      await this.guard()
      if (!await this.receipt(operationId)) await validate?.()
      return await this.enqueue(detached, operationId)
    })
    await this.afterCommit(); return receipt
  }

  async account(): Promise<PuzzleAccount> {
    return this.database.transaction('r', this.tables(), async () => {
      const row = await this.database.constellationBank.get('main'), bank = row ? checked(parseConstellationBankSave(row.data), 'bank') : null
      const outfits = (await this.database.puzzleOutfits.toArray()).map(r => checked(parsePuzzleOutfitSave(r.data), 'outfit'))
      const saved = (await this.database.puzzlePresets.toArray()).map(r => checked(parsePuzzlePresetSave(r.data), 'party'))
      const checkpoints = (await this.database.puzzleCheckpoints.toArray()).map(r => checked(parsePuzzleCheckpointSave(r.data), 'checkpoint'))
      const stocks = await this.stocks()
      const umas = (await this.database.umas.toArray()).map(r => parseUmaSaveOrThrow(r.data))
      const pending = (await this.database.pendingPuzzleOperations.toArray()).filter(r => ['cl-spend', 'exchange'].includes(r.operation.payload.kind))
      const accepted = (await this.database.puzzleOperations.toArray()).filter(r => ['cl-spend', 'exchange'].includes(r.data.operation.payload.kind))
      const materialOperations = [...pending.map(r => ({ id: r.id, status: r.status, reason: r.reason ?? null })),
        ...accepted.map(r => ({ id: r.id, status: 'accepted' as const, reason: null }))]
      return { readiness: puzzleReadiness(this.enabled, bank), bank, outfits,
        parties: PUZZLE_PARTY_IDS.map(id => saved.find(p => p.partyId === id) ?? emptyPuzzleParty(id)), checkpoints, stocks, umas, materialOperations }
    })
  }
  async registration(outfitId: string) {
    const source = this.options.source(outfitId)
    const owned = await this.database.umas.get(outfitId)
    if (!owned || parseUmaSaveOrThrow(owned.data).templateId !== source.templateId) return failure('conflict', 'Only an owned, verified outfit can enroll.')
    return { source, elements: eligiblePuzzleElements(source), styles: eligiblePuzzleStyles(source), stats: puzzleStats(source, 1) }
  }
  enroll(outfitId: string, element: PuzzleElement, operationId: string) {
    const source = this.options.source(outfitId)
    return this.mutation({ kind: 'enroll', source, element }, operationId)
  }
  correct(outfitId: string, element: PuzzleElement, revision: number, operationId: string) {
    return this.mutation({ kind: 'correct', outfitId, element }, operationId, async () => {
      const outfit = checked(parsePuzzleOutfitSave((await this.database.puzzleOutfits.get(outfitId))?.data), 'outfit')
      if (outfit.revision !== revision) failure('stale', 'The enrollment changed; reopen its setup.')
    })
  }
  equip(outfitId: string, kit: PuzzleKit, revision: number, operationId: string) {
    return this.mutation({ kind: 'equip-outfit', outfitId, kit }, operationId, async () => {
      const outfit = checked(parsePuzzleOutfitSave((await this.database.puzzleOutfits.get(outfitId))?.data), 'outfit')
      if (outfit.revision !== revision) failure('stale', 'The loadout changed; reopen its setup.')
    })
  }
  saveParty(party: PuzzlePresetSaveV1, operationId: string) {
    return this.mutation({ kind: 'save-party', party }, operationId, async () => {
      const row = await this.database.puzzlePresets.get(party.partyId)
      if ((row ? checked(parsePuzzlePresetSave(row.data), 'party').revision : 0) !== party.revision) failure('stale', 'The party changed; reopen it.')
    })
  }
  transfer(input: { outfitId: string; fromPartyId: string; toPartyId: string; slot: number; fromRevision: number; toRevision: number }, operationId: string) {
    return this.mutation({ kind: 'transfer', outfitId: input.outfitId, fromPartyId: input.fromPartyId, toPartyId: input.toPartyId, slot: input.slot }, operationId, async () => {
      for (const [id, revision] of [[input.fromPartyId, input.fromRevision], [input.toPartyId, input.toRevision]] as const) {
        const party = checked(parsePuzzlePresetSave((await this.database.puzzlePresets.get(id))?.data), 'party')
        if (party.revision !== revision) failure('stale', 'One of the parties changed; review the move again.')
      }
    })
  }
  async openChapter(partyId: string, scenarioId: string, operationId: string) {
    // Reopening the same foreground chapter is write-free, including a party with a suspended fight.
    const payload: PuzzlePayload = { kind: 'open-chapter', partyId, scenarioId }
    const result = await this.database.transaction('rw', this.tables(), async () => {
      await this.guard()
      const prior = await this.receipt(operationId)
      if (prior) return await this.enqueue(payload, operationId)
      const party = checked(parsePuzzlePresetSave((await this.database.puzzlePresets.get(partyId))?.data), 'party')
      const checkpoint = await this.database.puzzleCheckpoints.get(puzzleCampaignId({ kind: 'checkpoint', partyId, scenarioId }))
      if (checkpoint && party.foregroundChapter === puzzleCampaignId({ kind: 'chapter', scenarioId })) return null
      return await this.enqueue(payload, operationId)
    })
    if (result) await this.afterCommit()
    return result
  }

  private async openFor(battleId: string): Promise<PuzzleOpenEncounterV1> {
    const id = parsePuzzleCampaignId(battleId)
    if (id?.kind !== 'battle') return failure('missing-battle', 'Unknown battle identity.')
    const row = await this.database.puzzleCheckpoints.get(puzzleCampaignId({ kind: 'checkpoint', partyId: id.partyId, scenarioId: id.scenarioId }))
    const checkpoint = row ? checked(parsePuzzleCheckpointSave(row.data), 'frozen checkpoint') : null
    if (!checkpoint?.open || checkpoint.open.input.battleId !== battleId) return failure('missing-battle', 'This battle is not open. Reopen its result or map.')
    return checkpoint.open
  }
  private async result(battleId: string): Promise<PuzzleResultView | null> {
    const row = await this.database.puzzleResults.get(battleId)
    if (row) return this.resultView(checked(parsePuzzleResultSave(row.data), 'result'), false)
    for (const p of await this.database.pendingPuzzleOperations.orderBy('order').toArray()) {
      const raw = p.prediction.logs.find(l => l.kind === 'puzzleResults' && l.id === battleId)
      if (!raw) continue
      if (p.status !== 'pending') return failure('conflict', p.reason ?? 'The saved result was rejected; no rewards remain applied.')
      return this.resultView(checked(parsePuzzleResultSave(raw.data), 'pending result'), true)
    }
    return null
  }
  /** Optional device-only combat detail replayed from retained evidence. Never changes a receipt or save schema. */
  private async resultView(receipt: PuzzleResultSaveV1, pending: boolean): Promise<PuzzleResultView> {
    let raw: unknown = await this.database.puzzleJournals.get(receipt.battleId)
    if (!raw) {
      const archive = await this.database.puzzleArchives.get(`journal:${receipt.battleId}:${receipt.result.ownerEpoch}`)
      raw = (archive?.data as { journal?: unknown } | undefined)?.journal
    }
    let summary: PuzzleCombatSummary | null = null
    const journal = parsePuzzleJournal(raw)
    if (journal?.inputHash === receipt.inputHash && journal.ownerEpoch === receipt.result.ownerEpoch &&
      journal.actions.length === receipt.result.actionCount) {
      try {
        const replay = replayPuzzleBattle(receipt.input, journal.actions)
        if (puzzleBattleStateHash(replay.state) === receipt.result.stateHash) summary = puzzleCombatSummary(replay.steps)
      } catch { /* Receipt stays usable on another device without compatible local detail. */ }
    }
    return { kind: 'result', receipt, pending, summary }
  }
  private async archive(battleId: string, reason: string, open: PuzzleOpenEncounterV1 | null) {
    const journal = await this.database.puzzleJournals.get(battleId)
    if (!journal) return
    await this.database.puzzleArchives.put({ id: `journal:${battleId}:${journal.ownerEpoch}`, reason, data: { open, journal }, createdAt: this.now() })
    this.wrote('archive'); await this.database.puzzleJournals.delete(battleId); this.wrote('journal-close')
  }
  async loadBattle(battleId: string): Promise<PuzzleLoadedBattle> {
    let open: PuzzleOpenEncounterV1 | null = null, lease: PuzzleCastLease | null = null
    try {
      const initial = await this.database.transaction('rw', this.tables(), async () => {
        await this.guard()
        const result = await this.result(battleId)
        if (result) { await this.archive(battleId, 'Canonical or durable pending result', null); return result }
        open = await this.openFor(battleId)
        if (open.deviceId !== this.options.deviceId) {
          await this.archive(battleId, 'Displaced owner', open)
          return { kind: 'recovery' as const, code: 'foreign-owner' as const, message: `This fight belongs to device ${open.deviceId}. Resume there or explicitly take over online.`, open }
        }
        const row = await this.database.puzzleJournals.get(battleId)
        if (row && row.ownerEpoch < open.ownerEpoch) {
          await this.archive(battleId, 'Canonical owner epoch superseded journal', open)
          return { kind: 'recovery' as const, code: 'displaced' as const, message: 'The canonical owner epoch changed. Use explicit online restore; the old journal is archived.', open }
        }
        return { kind: 'journal' as const, open, replay: replayPuzzleJournal(open, row) }
      })
      if (initial.kind !== 'journal') return initial
      try {
        lease = await this.options.acquire(initial.open.content)
        if (puzzleCanonical(lease.identity) !== puzzleCanonical(initial.open.content) || lease.cast.manifestVersion !== initial.open.input.content.manifestVersion)
          throw new Error('Wrong retained pack')
      } catch { return failure('content-unavailable', 'The retained fight art is unavailable. Retry content; the input and journal were not reset.') }
      const acquired = lease
      return await this.database.transaction('r', this.tables(), async () => {
        const current = await this.openFor(battleId)
        if (puzzleCanonical(current) !== puzzleCanonical(initial.open)) return failure('stale', 'Ownership changed while restoring; reload this fight.')
        const replay = replayPuzzleJournal(current, await this.database.puzzleJournals.get(battleId))
        return { kind: 'battle', open: current, state: replay.state, actions: replay.journal.actions,
          stateHash: replay.journal.stateHash, lastStep: replay.steps.at(-1) ?? null, lease: acquired }
      })
    } catch (error) {
      lease?.release()
      if (!(error instanceof PuzzleRecoveryError)) throw error
      return { kind: 'recovery', code: error.code, message: error.message, open }
    }
  }

  async begin(input: { partyId: string; scenarioId: string; nodeId: string; darkVariant: PuzzleDarkVariant | null;
    partyRevision: number; checkpointRevision: number }, operationId: string): Promise<PuzzleLoadedBattle> {
    const request = structuredClone(input)
    const existing = await this.database.transaction('r', this.tables(), async () => {
      await this.guard()
      const receipt = await this.receipt(operationId)
      if (receipt) {
        const p = receipt.operation.payload
        if (p.kind !== 'reserve') return failure('conflict', 'This id is not a reservation.')
        const identity = parsePuzzleCampaignId(p.encounter.input.battleId)
        if (!identity || identity.kind !== 'battle' || identity.partyId !== request.partyId || identity.scenarioId !== request.scenarioId ||
          puzzleCampaignId({ kind: 'node', scenarioId: identity.scenarioId, localId: identity.localId }) !== request.nodeId ||
          identity.localId === 'c-dark' && p.encounter.input.rewards[0]?.style !== request.darkVariant)
          failure('conflict', 'This reservation id was reused for another encounter.')
        return p.encounter.input.battleId
      }
      const all = (await this.database.puzzleCheckpoints.toArray()).map(r => checked(parsePuzzleCheckpointSave(r.data), 'checkpoint'))
      return all.find(c => c.progress.partyId === request.partyId && c.open)?.open?.input.battleId ?? null
    })
    if (existing) return this.loadBattle(existing)
    // Content I/O is outside IndexedDB; every save/revision is re-read after verification.
    const lease = await this.options.acquire()
    let battleId: string
    try {
      battleId = await this.database.transaction('rw', this.tables(), async () => {
        const bank = await this.guard()
        if (lease.cast.manifestVersion !== `puzzles-${lease.identity.contentHash}`) return failure('content-unavailable', 'Verified cast and immutable identity disagree.')
        const all = (await this.database.puzzleCheckpoints.toArray()).map(r => checked(parsePuzzleCheckpointSave(r.data), 'checkpoint'))
        const concurrent = all.find(c => c.progress.partyId === request.partyId && c.open)?.open
        if (concurrent) return concurrent.input.battleId
        const party = checked(parsePuzzlePresetSave((await this.database.puzzlePresets.get(request.partyId))?.data), 'party')
        const chapter = SCENARIOS.find(s => s.id === request.scenarioId)
        if (!chapter) return failure('conflict', 'Unknown scenario.')
        const map = puzzleChapter(chapter.id), id = puzzleCampaignId({ kind: 'checkpoint', partyId: party.partyId, scenarioId: chapter.id })
        const saved = (await this.database.puzzleCheckpoints.get(id))?.data
        const checkpoint = saved ? checked(parsePuzzleCheckpointSave(saved), 'checkpoint') : null
        if (party.revision !== request.partyRevision || (checkpoint?.revision ?? 0) !== request.checkpointRevision) return failure('stale', 'Party or map changed. Review the node before entry.')
        if (party.slots.some(s => !s)) return failure('conflict', 'Fill all five party slots before entry.')
        const entrants = []
        for (const slot of party.slots) {
          const outfit = checked(parsePuzzleOutfitSave((await this.database.puzzleOutfits.get(slot!.outfitId))?.data), 'entrant')
          const e = outfit.enrollment
          entrants.push({ outfitId: outfit.outfitId, source: e.source, level: e.level, element: e.element, kit: slot!.kit, stats: puzzleStats(e.source, e.level) })
        }
        const frozen = freezePuzzleEncounter({ chapter: map, checkpoint: checkpoint?.progress ?? createPuzzleCheckpoint(map, party.partyId),
          nodeId: request.nodeId, entrants, leaderId: party.leaderId, cast: lease.cast, accountSeed: bank.cutoverId, ownerEpoch: 0, darkVariant: request.darkVariant })
        const open: PuzzleOpenEncounterV1 = { schemaVersion: 1, deviceId: this.options.deviceId, ownerEpoch: 0, input: frozen,
          inputHash: puzzlePayloadHash(frozen), content: lease.identity }
        await this.enqueue({ kind: 'reserve', encounter: open }, operationId)
        if (await this.database.puzzleJournals.get(frozen.battleId)) return failure('conflict', 'An existing journal cannot be overwritten by entry.')
        await this.database.puzzleJournals.add({ id: frozen.battleId, schemaVersion: 1, ownerEpoch: 0, inputHash: open.inputHash,
          actions: [], stateHash: puzzleBattleStateHash(createPuzzleBattle(frozen)), updatedAt: this.now() })
        this.wrote('journal'); return frozen.battleId
      })
    } finally { lease.release() }
    await this.afterCommit(); return this.loadBattle(battleId)
  }
  async append(battleId: string, epoch: number, expectedCount: number, action: PuzzleBattleAction): Promise<PuzzleBattleTransition> {
    const detached = structuredClone(action)
    return this.database.transaction('rw', this.tables(), async () => {
      await this.guard()
      const open = await this.openFor(battleId)
      if (open.deviceId !== this.options.deviceId || open.ownerEpoch !== epoch) return failure('displaced', 'This device/epoch no longer owns the fight.')
      const replay = replayPuzzleJournal(open, await this.database.puzzleJournals.get(battleId))
      if (replay.journal.actions.length !== expectedCount) return failure('stale', 'Another view advanced this fight. Reload the accepted journal.')
      const step = applyPuzzleBattleAction(replay.state, detached)
      const journal: PuzzleJournalRow = { ...replay.journal, actions: [...replay.journal.actions, detached],
        stateHash: puzzleBattleStateHash(step.state), updatedAt: this.now() }
      await this.database.puzzleJournals.put(journal); this.wrote('journal')
      return step
    })
  }
  async commit(claim: PuzzleCommitClaim): Promise<PuzzleResultView> {
    const result = await this.database.transaction('rw', this.tables(), async () => {
      await this.guard()
      const prior = await this.result(claim.battleId)
      if (prior) {
        if (prior.receipt.result.ownerEpoch !== claim.ownerEpoch || prior.receipt.result.actionCount !== claim.expectedCount || prior.receipt.result.stateHash !== claim.stateHash)
          return failure('conflict', 'This battle already has a different terminal receipt.')
        return prior
      }
      const open = await this.openFor(claim.battleId)
      if (open.deviceId !== this.options.deviceId || open.ownerEpoch !== claim.ownerEpoch) return failure('displaced', 'This device/epoch cannot settle the fight.')
      const replay = replayPuzzleJournal(open, await this.database.puzzleJournals.get(claim.battleId))
      if (replay.journal.actions.length !== claim.expectedCount || replay.journal.stateHash !== claim.stateHash) return failure('stale', 'The terminal claim does not match the accepted journal.')
      const terminal = puzzleBattleResult(replay.state)
      const operationId = `pzs:${puzzlePayloadHash([claim.battleId, claim.ownerEpoch])}`
      await this.enqueue({ kind: 'settle', checkpointId: open.input.checkpointId, inputHash: open.inputHash, result: terminal }, operationId)
      const saved = checked(await this.result(claim.battleId), 'durable terminal receipt')
      this.wrote('result'); await this.archive(claim.battleId, 'Terminal receipt persisted', open)
      return saved
    })
    await this.afterCommit(); return result
  }

  private async stocks(): Promise<Record<string, number>> {
    const stocks: Record<string, number> = {}
    for (const row of await this.database.items.toArray()) if (row.id.startsWith('constellation:') || row.id === TRAINING_LEVEL_UP_TICKET_ID)
      stocks[row.id] = checked(parseInventoryStackData(row.data, row.id), 'material stock').quantity
    return stocks
  }
  private async materialPreview(payload: PuzzleMaterialPreview['payload']): Promise<PuzzleMaterialPreview> {
    const bank = await this.guard(), receipt = await this.coordinator.previewInTransaction(payload, this.now())
    const stocks = await this.stocks()
    const confirmation = puzzleCanonical({ payload, revision: bank.revision, stocks,
      before: receipt.changes.map(c => ({ kind: c.kind, id: c.id, before: c.before })) })
    return { payload, confirmation, revision: bank.revision, stocks, receipt }
  }
  async previewCl(outfitId: string, scenarioId: string, inputs: PuzzleMaterialInput[]) {
    const payload: PuzzleMaterialPreview['payload'] = { kind: 'cl-spend', outfitId, scenarioId, inputs: structuredClone(inputs) }
    if (!await this.database.puzzleOutfits.get(outfitId)) payload.source = this.options.source(outfitId)
    return this.database.transaction('r', this.tables(), async () => {
      const preview = await this.materialPreview(payload)
      return { ...preview, cl: await this.clResult(preview.receipt) }
    })
  }
  previewExchange(from: string, to: string, quantity: number) {
    return this.database.transaction('r', this.tables(), async () => {
      const preview = await this.materialPreview({ kind: 'exchange', from, to, quantity })
      return { ...preview, exchange: this.exchangeResult(preview.receipt) }
    })
  }
  async confirmMaterial(preview: PuzzleMaterialPreview, operationId: string) {
    const detached = structuredClone(preview)
    const result = await this.database.transaction('rw', this.tables(), async () => {
      await this.guard()
      const existing = await this.receipt(operationId)
      if (!existing) {
        let current: PuzzleMaterialPreview
        try { current = await this.materialPreview(detached.payload) }
        catch { return failure('stale', 'The material action is no longer valid. Review current stocks, CL and debt.') }
        if (current.confirmation !== detached.confirmation) return failure('stale', 'Stocks, CL, debt or source changed. Review the updated preview before spending.')
      }
      const receipt = await this.enqueue(detached.payload, operationId)
      // Canonical CL only: monotonic badges cannot be awarded from a spend the server might reject.
      if (this.options.content && detached.payload.kind === 'cl-spend') await reconcilePuzzleFlairInTransaction(this.database, this.options.content, this.now(), operationId)
      this.wrote('badges')
      return { receipt, cl: receipt.operation.payload.kind === 'cl-spend' ? await this.clResult(receipt) : null,
        exchange: receipt.operation.payload.kind === 'exchange' ? this.exchangeResult(receipt) : null }
    })
    await this.afterCommit(); return result
  }
  private async clResult(receipt: PuzzleOperationReceiptV1): Promise<PuzzleClResult> {
    const payload = receipt.operation.payload
    if (payload.kind !== 'cl-spend') throw new Error('Not a CL receipt')
    const c = checked(receipt.changes.find(c => c.kind === 'umas' && c.id === payload.outfitId) ?? null, 'CL change')
    const beforeUma = parseUmaSaveOrThrow(c.before?.data), afterUma = parseUmaSaveOrThrow(c.after.data)
    const tier = checked(SCENARIOS.find(s => s.id === payload.scenarioId) ?? null, 'scenario').tier
    const before = beforeUma.scenarios.find(s => s.tier === tier)!.trainingLevel, after = afterUma.scenarios.find(s => s.tier === tier)!.trainingLevel
    const nodes = nodesUnlockedBetween(constellationTemplate(tier), before, after).map(n => {
      const vertical = n.y < 34 ? 'upper' : n.y > 66 ? 'lower' : 'middle', horizontal = n.x < 34 ? 'left' : n.x > 66 ? 'right' : 'center'
      const position = vertical === 'middle' && horizontal === 'center' ? 'center' : `${vertical} ${horizontal}`
      return { id: n.id, label: `Card node ${n.order + 1} · ${position}` }
    })
    let delta: PuzzleClResult['delta'] = null
    if (this.options.content) {
      const content = this.options.content, cards = new Map((await this.database.cards.toArray()).map(r => [r.id, r.data]))
      const derive = (uma: UmaSave) => deriveUma({ uma, tier, umaTemplate: checked(content.umas.byId.get(uma.templateId) ?? null, 'Uma template'),
        cardSaves: cards, cardTemplates: content.cards.byId, umaTemplates: content.umas.byId, skillTemplates: content.skills.byId })
      const a = derive(beforeUma), b = derive(afterUma)
      delta = { stats: Object.fromEntries(STATS.map(k => [k, b.stats[k] - a.stats[k]])) as Stats, skillPoints: b.skillPoints - a.skillPoints }
    }
    return { outfitId: payload.outfitId, scenarioId: payload.scenarioId, before, after, spOnly: nodes.length === 0 && after > before,
      nodes, delta, href: `/constellation/${encodeURIComponent(payload.outfitId)}?tier=${tier}` }
  }
  private exchangeResult(receipt: PuzzleOperationReceiptV1) {
    const payload = receipt.operation.payload
    if (payload.kind !== 'exchange') throw new Error('Not an exchange receipt')
    const movement = checked(receipt.logs.find(l => l.kind === 'itemLedger' && l.data.itemId === payload.to) ?? null, 'exchange grant')
    const gross = Number(movement.data.delta), debtPaid = Number((movement.data.source as { debtPaid: number }).debtPaid)
    return { from: payload.from, to: payload.to, input: payload.quantity, gross, debtPaid, net: gross - debtPaid,
      irreversible: debtPaid > 0, bankAfter: checked(parseConstellationBankSave(receipt.changes.find(c => c.kind === 'constellationBank')?.after.data), 'exchange bank'),
      stocksAfter: receipt.changes.filter(c => c.kind === 'items').map(c => ({ itemId: c.id, quantity: checked(parseInventoryStackData(c.after.data, c.id), 'exchange stock').quantity })) }
  }

  /** Online only. Network completes before archiving/restarting a journal; no reroll on failure. */
  async takeover(battleId: string, expectedEpoch: number): Promise<PuzzleLoadedBattle> {
    await this.guard()
    const online = this.options.online
    if (!online?.available()) return failure('offline', 'Takeover needs an online acknowledgement. The fight is unchanged.')
    await online.flush()
    if (await this.database.pendingPuzzleOperations.count() || await this.database.outbox.count())
      return failure('conflict', 'Resolve outgoing changes before takeover. The fight is unchanged.')
    const open = await this.openFor(battleId)
    if (open.ownerEpoch !== expectedEpoch) return failure('stale', 'Ownership changed. Review the current encounter.')
    const request: PuzzleTakeoverRequest = { schemaVersion: 1, checkpointId: open.input.checkpointId, battleId, expectedEpoch, deviceId: this.options.deviceId }
    const response = checked(parsePuzzleTakeoverResponse(await online.takeover(request), request), 'takeover acknowledgement')
    if (response.status === 'taken-over') {
      const next = checked(parsePuzzleCheckpointSave(response.checkpoint.data), 'takeover checkpoint').open!
      if (puzzleCanonical({ ...next.input, ownerEpoch: open.ownerEpoch }) !== puzzleCanonical(open.input) || puzzleCanonical(next.content) !== puzzleCanonical(open.content))
        return failure('conflict', 'Takeover changed the frozen fight. Nothing was reset locally.')
    }
    // Refresh receipt-owned projections/evidence as a set, including a competing terminal settlement.
    const snapshot = checked(parseSaveSnapshot(await online.snapshot()), 'recovery snapshot')
    const canonical = snapshot.entities.find(r => r.kind === 'puzzleCheckpoints' && r.id === request.checkpointId)
    const checkpoint = canonical && parsePuzzleCheckpointSave(canonical.data)
    const terminal = snapshot.logs.find(r => r.kind === 'puzzleResults' && r.id === battleId)
    if (terminal) {
      const result = checked(parsePuzzleResultSave(terminal.data), 'canonical terminal result')
      if (puzzleCanonical({ ...result.input, ownerEpoch: open.ownerEpoch }) !== puzzleCanonical(open.input))
        return failure('conflict', 'Canonical result has a different frozen input; nothing was reset.')
      if (response.status === 'settled' && puzzleCanonical(response.result.data) !== puzzleCanonical(terminal.data))
        return failure('conflict', 'The canonical result changed during recovery; retry without resetting.')
    }
    // A lost prior acknowledgement can return stale to the retried POST. A verified online snapshot naming
    // this exact owner/epoch/input (or a terminal receipt) is the acknowledgement, not an offline guess.
    if (!terminal && (!checkpoint?.open || checkpoint.open.deviceId !== this.options.deviceId || checkpoint.open.ownerEpoch !== expectedEpoch + 1 ||
      puzzleCanonical({ ...checkpoint.open.input, ownerEpoch: open.ownerEpoch }) !== puzzleCanonical(open.input) || puzzleCanonical(checkpoint.open.content) !== puzzleCanonical(open.content)))
      return failure('conflict', response.status === 'rejected' ? response.reason : 'Canonical ownership is not confirmed; retry recovery without resetting.')
    if (!terminal) {
      // An acknowledged owner change is not permission to discard the journal just because art is missing.
      let lease: PuzzleCastLease | null = null
      try {
        lease = await this.options.acquire(open.content)
        if (puzzleCanonical(lease.identity) !== puzzleCanonical(open.content) || lease.cast.manifestVersion !== open.input.content.manifestVersion) throw new Error('Wrong retained pack')
      } catch { return failure('content-unavailable', 'Ownership was acknowledged but retained art is unavailable. Retry recovery; the old journal has not been reset.') }
      finally { lease?.release() }
    }
    await this.database.transaction('rw', this.tables(), async () => {
      if (await this.database.pendingPuzzleOperations.count() || await this.database.outbox.count()) return failure('stale', 'A local change arrived during takeover. Sync it before retrying recovery.')
      const current = await this.openFor(battleId)
      if (puzzleCanonical(current) !== puzzleCanonical(open)) return failure('stale', 'The local descriptor changed during takeover.')
      await this.coordinator.adoptSnapshotInTransaction(snapshot.entities.filter(r => ['puzzleOutfits', 'puzzlePresets', 'puzzleCheckpoints', 'constellationBank', 'puzzleCohort', 'umas'].includes(r.kind) ||
        r.kind === 'items' && (r.id.startsWith('constellation:') || r.id === TRAINING_LEVEL_UP_TICKET_ID)),
      snapshot.logs.filter(l => ['puzzleResults', 'puzzleOperations'].includes(l.kind) || l.kind === 'itemLedger' && l.data.reason === 'puzzle-material'), this.now())
      await this.archive(battleId, terminal ? 'Canonical result won takeover race' : 'Acknowledged same-seed takeover', open)
      if (!terminal) {
        const next = checkpoint!.open!
        await this.database.puzzleJournals.put({ id: battleId, schemaVersion: 1, ownerEpoch: next.ownerEpoch, inputHash: next.inputHash,
          actions: [], stateHash: puzzleBattleStateHash(createPuzzleBattle(next.input)), updatedAt: this.now() }); this.wrote('journal')
      }
      if (this.options.content) await reconcilePuzzleFlairInTransaction(this.database, this.options.content, this.now(), battleId)
    })
    await this.afterCommit(); return this.loadBattle(battleId)
  }
}
