// Receipt-gated chapter navigation, separate from battles and rewards (docs/design/uma-rpg.md, T095).
import {
  assertRpgChapterCheckpoint, isRpgBattleNode, projectRpgStats, rpgAcceptBattleNode, rpgAcceptSafeNode,
  rpgChapterChoices, rpgCheckpointId, rpgResultId, validateRpgLoadout,
  parseSaveSnapshotOrThrow, parseUmaSave,
  rpgInspirationReward, inspirationGrantId, inspirationTokenId, parseInspirationMovement, type InspirationMovement,
  type EncounterInput, type RpgChapter, type RpgChapterPack, type RpgCheckpointSaveV1,
  type RpgCommandRequest, type RpgOutfitSaveV1, type RpgPresetSaveV1, type RpgPackIdentity,
} from '@racer/domain'
import { db, type RacerDb, type VersionedRow, type PendingRpgCommandRow } from './db'
import { DexieRpgBattleHost, decodeInspirationReward } from './rpg-battle-host'
import { enqueueRpgCommand } from './rpg-sync'
import { saveApi } from '../api/client'
import { queueInTransaction } from './persistence'

export interface RpgChapterView {
  pack: RpgChapterPack | null; chapter: RpgChapter | null; unavailable: string | null
  preset: VersionedRow<RpgPresetSaveV1> | null; checkpoint: VersionedRow<RpgCheckpointSaveV1> | null
  outfits: VersionedRow<RpgOutfitSaveV1>[]; checkpoints: VersionedRow<RpgCheckpointSaveV1>[]; pending: PendingRpgCommandRow[]
  tokenGrants: InspirationMovement[]
}
const data = (v: object) => v as unknown as Record<string, unknown>

export class RpgChapterHost {
  readonly battle: DexieRpgBattleHost
  constructor(private readonly pack: (identity?: RpgPackIdentity) => Promise<RpgChapterPack | null>, readonly database: RacerDb = db,
    private readonly now: () => number = Date.now, private readonly account: Pick<typeof saveApi, 'load'> = saveApi) { this.battle = new DexieRpgBattleHost(now, database) }

  async read(presetId: string, chapterId?: string): Promise<RpgChapterView> {
    const [preset, checkpoints, outfits, allPending] = await Promise.all([
      this.database.rpgPresets.get(presetId), this.database.rpgCheckpoints.toArray(),
      this.database.rpgOutfits.toArray(), this.database.pendingRpgCommands.toArray(),
    ])
    const selectedId = chapterId ?? preset?.data.foregroundChapterId
    const checkpoint = selectedId ? checkpoints.find((c) => c.id === rpgCheckpointId(presetId, selectedId)) ?? null : null
    const pending = allPending.filter((r) => (r.body as RpgCommandRequest).expected.some((e) => e.kind === 'rpgPresets' && e.id === presetId || e.kind === 'rpgCheckpoints' && e.id.startsWith(`${presetId}:`)))
    let pack: RpgChapterPack | null = null, unavailable: string | null = null
    try { pack = await this.pack(checkpoint?.data) } catch { unavailable = 'Private chapter content could not be verified or its frozen version is not retained. Your progress is unchanged.' }
    const chapter = pack?.chapters.find((c) => c.id === selectedId) ?? null
    if (!pack) unavailable ??= 'Private chapter pack unavailable. No test encounters will replace it.'
    else if (selectedId && !chapter) unavailable = 'Frozen chapter content unavailable: this chapter is absent from the pack.'
    if (chapter && checkpoint) {
      try { assertRpgChapterCheckpoint(chapter, checkpoint.data) } catch (e) { unavailable = String(e) }
    }
    const tokenGrants = (await this.database.itemLedger.toArray()).flatMap(r => {
      const movement = parseInspirationMovement(r.data)
      return movement?.source.kind === 'rpg-inspiration' && movement.source.attemptId === checkpoint?.data.attemptId ? [movement] : []
    })
    return { pack, chapter, unavailable, preset: preset ?? null, checkpoint, outfits, tokenGrants,
      checkpoints: checkpoints.filter((c) => c.data.presetId === presetId), pending }
  }

  private async ready(presetId: string, chapterId: string) {
    const view = await this.read(presetId, chapterId)
    if (!view.preset || !view.chapter || view.unavailable) throw new Error(view.unavailable ?? 'Saved party unavailable')
    if (view.pending.length) throw new Error('RPG change is pending or conflicted. Wait for acknowledgement or reload the account.')
    return { ...view, preset: view.preset, chapter: view.chapter }
  }

  private party(view: RpgChapterView): EncounterInput['allies'] {
    if (!view.preset || view.preset.data.slots.some((s) => s === null)) throw new Error('Fill all five party slots before entering a chapter')
    return view.preset.data.slots.map((slot) => {
      const row = view.outfits.find((o) => o.id === slot!.outfitId)
      if (!row || !row.data.profile.affinities[slot!.signature] || !validateRpgLoadout(row.data.profile, slot!.signature, slot!.loadout)) throw new Error('Party profile or loadout unavailable')
      const p = row.data.profile
      return { id: p.outfitId, style: p.style, weapon: p.weapon, tier: p.tier, level: p.level,
        stats: projectRpgStats(p), affinities: p.affinities, signature: slot!.signature,
        tree: p.tree, legacy: p.legacy, loadout: slot!.loadout }
    })
  }

  async start(presetId: string, chapterId: string, replay = false): Promise<void> {
    const view = await this.ready(presetId, chapterId)
    this.party(view)
    if (view.checkpoint && !(replay && view.checkpoint.data.status === 'cleared')) throw new Error('Resume this chapter; only an explicit replay after clear creates another attempt')
    if (!view.checkpoint && replay) throw new Error('No cleared chapter to replay')
    await this.requireSafeForeground(view, chapterId)
    // A deliberate new attempt uses current content; resuming never replaces an older checkpoint.
    const currentChapter = (await this.pack())?.chapters.find(c => c.id === chapterId)
    if (!currentChapter) throw new Error('Current chapter content unavailable')
    const attemptIndex = (view.checkpoint?.data.attemptIndex ?? 0) + 1
    const next: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId, chapterId, contentVersion: currentChapter.contentVersion,
      contentHash: currentChapter.contentHash, attemptIndex, attemptId: `rpg-attempt:${presetId}:${chapterId}:${attemptIndex}`,
      lastClearedNodeId: null, selectedPath: [], status: 'at-checkpoint', revision: (view.checkpoint?.data.revision ?? -1) + 1, frozenEntry: null }
    const preset = { ...view.preset.data, foregroundChapterId: chapterId }
    await this.queue({ schemaVersion: 1, commandId: `rpg-start:${presetId}:${chapterId}:${attemptIndex}`, action: 'start-chapter',
      expected: [{ kind: 'rpgCheckpoints', id: rpgCheckpointId(presetId, chapterId), version: view.checkpoint?.version ?? 0 },
        { kind: 'rpgPresets', id: presetId, version: view.preset.version },
        ...this.party(view).map((ally) => ({ kind: 'rpgOutfits' as const, id: ally.id, version: view.outfits.find((r) => r.id === ally.id)!.version }))],
      upserts: [{ kind: 'rpgCheckpoints', id: rpgCheckpointId(presetId, chapterId), data: data(next) }, { kind: 'rpgPresets', id: presetId, data: data(preset) }], appends: [] })
  }

  private async requireSafeForeground(view: RpgChapterView, chapterId: string): Promise<void> {
    const foreground = view.preset!.data.foregroundChapterId
    const current = view.checkpoints.find((c) => c.data.chapterId === foreground)
    if (foreground !== chapterId && current && ['in-battle', 'pending-result'].includes(current.data.status)) throw new Error('Pause the foreground battle explicitly and sync its result before switching chapters')
  }

  async focus(presetId: string, chapterId: string): Promise<void> {
    const view = await this.ready(presetId, chapterId)
    if (!view.checkpoint) throw new Error('Start this chapter first')
    if (view.preset.data.foregroundChapterId === chapterId) return
    await this.requireSafeForeground(view, chapterId)
    const preset = { ...view.preset.data, foregroundChapterId: chapterId }
    await this.queue({ schemaVersion: 1, commandId: `rpg-focus:${presetId}:${view.preset.version}:${chapterId}`, action: 'edit-preset',
      expected: [{ kind: 'rpgPresets', id: presetId, version: view.preset.version },
        ...preset.slots.flatMap((s) => s ? [{ kind: 'rpgOutfits' as const, id: s.outfitId, version: view.outfits.find((o) => o.id === s.outfitId)!.version }] : [])],
      upserts: [{ kind: 'rpgPresets', id: presetId, data: data(preset) }], appends: [] })
  }

  async choose(uid: string, presetId: string, chapterId: string, nodeId: string): Promise<'battle' | 'map'> {
    const view = await this.ready(presetId, chapterId)
    if (!view.checkpoint || view.preset.data.foregroundChapterId !== chapterId) throw new Error('Resume this chapter as the foreground first')
    const cp = view.checkpoint.data
    if (cp.status === 'at-checkpoint' && cp.frozenEntry) {
      if (cp.frozenEntry.nodeId !== nodeId) throw new Error('Retry must use the identical frozen encounter')
      await this.battle.enter(uid, view.checkpoint.id, nodeId)
      return 'battle'
    }
    const node = rpgChapterChoices(view.chapter, cp).find((n) => n.id === nodeId)
    if (!node) throw new Error('Node is not on the available path')
    if (isRpgBattleNode(node)) {
      const input: EncounterInput = { version: 1, contentVersion: cp.contentVersion, seed: 0, weaknessFollowUp: 'bounded',
        allies: this.party(view), enemies: node.enemies.map((id) => view.pack!.actors.find((a) => a.id === id)!.combat) }
      await this.battle.enter(uid, view.checkpoint.id, nodeId, input, { baseExp: node.baseExp ?? 0,
        recommendedTier: view.chapter.recommendedTier, recommendedLevel: view.chapter.recommendedLevel }, rpgInspirationReward(view.chapter, node))
      return 'battle'
    }
    await this.move(view.checkpoint, rpgAcceptSafeNode(view.chapter, cp, nodeId), 'choose-node')
    return 'map'
  }

  async advance(presetId: string, chapterId: string): Promise<void> {
    const view = await this.ready(presetId, chapterId)
    const cp = view.checkpoint
    if (!cp?.data.frozenEntry || cp.data.status !== 'pending-result') throw new Error('No accepted win to advance')
    const entry = cp.data.frozenEntry
    const evidence = await this.database.rpgResults.get(rpgResultId(entry.entryId, entry.retryOrdinal))
    if (!evidence) throw new Error('Battle result is not acknowledged; map progress remains locked')
    const next = rpgAcceptBattleNode(view.chapter, cp.data, evidence.data)
    await this.move(cp, next, next.status === 'cleared' ? 'clear-chapter' : 'choose-node')
  }

  private async move(before: VersionedRow<RpgCheckpointSaveV1>, next: RpgCheckpointSaveV1, action: 'choose-node' | 'clear-chapter') {
    const body: RpgCommandRequest = { schemaVersion: 1, commandId: `rpg-map:${before.id}:${next.revision}`, action,
      expected: [{ kind: 'rpgCheckpoints', id: before.id, version: before.version }],
      upserts: [{ kind: 'rpgCheckpoints', id: before.id, data: data(next) }], appends: [] }
    const entry = before.data.status === 'pending-result' ? before.data.frozenEntry : null
    const reward = entry && decodeInspirationReward(entry.enemyKitJson)
    if (entry && reward) for (const kind of ['slot', 'skill'] as const) {
      const delta = reward[kind]
      if (!delta) continue
      const itemId = inspirationTokenId(reward.tier, kind), stack = await this.database.items.get(itemId), now = this.now()
      const quantity = (stack?.data.quantity ?? 0) + delta
      if (!Number.isSafeInteger(quantity)) throw new Error('Token inventory overflow')
      const movement: InspirationMovement = { id: inspirationGrantId(entry.entryId, kind), itemId, delta,
        reason: 'rpg-inspiration', source: { kind: 'rpg-inspiration', entryId: entry.entryId,
          attemptId: before.data.attemptId, tier: reward.tier, tokenKind: kind }, createdAt: now }
      body.expected.push({ kind: 'items', id: itemId, version: stack?.version ?? 0 })
      body.upserts.push({ kind: 'items', id: itemId, data: { itemId, quantity, updatedAt: now } })
      body.appends.push({ kind: 'itemLedger', id: movement.id, data: data(movement), createdAt: now })
    }
    await this.queue(body)
  }

  private async queue(body: RpgCommandRequest) {
    await this.database.transaction('rw', [this.database.pendingRpgCommands, this.database.rpgCheckpoints, this.database.rpgPresets, this.database.rpgOutfits, this.database.items, this.database.outbox], async () => {
      for (const e of body.expected) {
        const row = await this.database.table(e.kind).get(e.id) as VersionedRow<unknown> | undefined
        if ((row?.version ?? 0) !== e.version) throw new Error('Chapter revision changed before reservation')
        if (e.kind === 'items' && await this.database.outbox.where('[kind+id]').equals([e.kind, e.id]).count()) throw new Error('Sync the Item inventory before collecting tokens')
      }
      const pending = await this.database.pendingRpgCommands.toArray()
      if (pending.some((r) => (r.body as RpgCommandRequest).upserts.some((u) => body.expected.some((e) => e.kind === u.kind && e.id === u.id)))) throw new Error('Chapter change already reserved; wait for acknowledgement')
      await enqueueRpgCommand(body, this.now(), null, this.database)
    })
  }

  /** Explicit conflict recovery. Never rebases rejected wins; rejected journals are archived locally. */
  async refreshAccount(discardRejected = false, transport: Pick<typeof saveApi, 'load'> = this.account): Promise<void> {
    const raw = await transport.load()
    const snapshot = parseSaveSnapshotOrThrow(raw)
    // The snapshot parser migrates supported data. Compare raw rows after validation to queue cloud replacements.
    const legacyUmaIds = new Set((raw as { entities: { kind: string; id: string; data: unknown }[] }).entities
      .filter(e => e.kind === 'umas' && !parseUmaSave(e.data)).map(e => e.id))
    await this.database.transaction('rw', [this.database.rpgOutfits, this.database.rpgPresets, this.database.rpgCheckpoints,
      this.database.rpgResults, this.database.rpgReceipts, this.database.rpgPromotions, this.database.pendingRpgCommands,
      this.database.rpgBattleJournals, this.database.rpgBattleArchives, this.database.rpgBattleClaims,
      this.database.umas, this.database.items, this.database.itemLedger, this.database.outbox], async () => {
      const migratedUmaIds: string[] = []
      for (const e of snapshot.entities) {
        if (!['rpgOutfits', 'rpgPresets', 'rpgCheckpoints', 'umas', 'items'].includes(e.kind)) continue
        // Never overwrite a newer ordinary edit while refreshing token conflict dependencies.
        if ((e.kind === 'umas' || e.kind === 'items') &&
          await this.database.outbox.where('[kind+id]').equals([e.kind, e.id]).count()) continue
        const local = await this.database.table(e.kind).get(e.id) as VersionedRow<unknown> | undefined
        if (local && local.version > e.version) continue
        if (e.deleted) await this.database.table(e.kind).delete(e.id)
        else {
          if (e.kind === 'umas' && legacyUmaIds.has(e.id)) migratedUmaIds.push(e.id)
          await this.database.table(e.kind).put({ id: e.id, version: e.version, data: e.data })
        }
      }
      for (const e of snapshot.logs) if (['rpgResults', 'rpgReceipts', 'rpgPromotions', 'itemLedger'].includes(e.kind)) {
        await this.database.table(e.kind).put({ id: e.id, createdAt: e.createdAt, data: e.data })
      }
      if (discardRejected) {
        const rows = await this.database.pendingRpgCommands.toArray()
        const rejected = new Set(rows.filter((r) => r.status === 'conflict').map((r) => r.id))
        // Descendant results can never be retried independently of their rejected entry.
        let changed = true
        while (changed) {
          changed = false
          for (const r of rows) if (r.dependsOn && rejected.has(r.dependsOn) && !rejected.has(r.id)) { rejected.add(r.id); changed = true }
        }
        for (const row of rows.filter((r) => rejected.has(r.id))) {
          const body = row.body as RpgCommandRequest
          const update = body.upserts.find((u) => u.kind === 'rpgCheckpoints')
          const entry = (update?.data as unknown as RpgCheckpointSaveV1 | undefined)?.frozenEntry
          if (!entry) continue
          // Loss commands contain the *next* retry ordinal; their evidence names the journal just rejected.
          const journalId = body.appends.find((a) => a.kind === 'rpgResults')?.id ?? rpgResultId(entry.entryId, entry.retryOrdinal)
          if (await this.database.rpgResults.get(journalId)) continue
          const journal = await this.database.rpgBattleJournals.get(journalId)
          if (journal) {
            await this.database.rpgBattleArchives.put({ id: `${journalId}:rejected-${row.id}`,
              journal: { ...journal, commitStatus: 'conflict' }, reason: 'rejected-command' })
            await this.database.rpgBattleJournals.delete(journalId)
          }
          const accepted = update && await this.database.rpgCheckpoints.get(update.id)
          const frozen = accepted?.data.frozenEntry
          const claim = await this.database.rpgBattleClaims.get(journalId)
          // Retain ownership only for this exact accepted lease. Otherwise an explicit takeover is required.
          if (!frozen || rpgResultId(frozen.entryId, frozen.retryOrdinal) !== journalId || claim?.leaseRevision !== frozen.leaseRevision) {
            await this.database.rpgBattleClaims.delete(journalId)
          }
        }
        await this.database.pendingRpgCommands.bulkDelete([...rejected])
      }
      // Ordinary queue helpers use the account database; isolated DEV/test hosts queue the equivalent marker here.
      for (const id of migratedUmaIds) {
        if (this.database === db) await queueInTransaction('umas', id, 'upsert', snapshot.serverTime)
        else {
          const pending = await this.database.pendingRpgCommands.toArray()
          if (pending.some(p => (p.body as RpgCommandRequest).upserts.some(u => u.kind === 'umas' && u.id === id))) {
            throw new Error('Resolve the pending Uma change before migrating its recovered row')
          }
          await this.database.outbox.where('[kind+id]').equals(['umas', id]).delete()
          await this.database.outbox.add({ kind: 'umas', id, op: 'upsert', queuedAt: snapshot.serverTime })
        }
      }
    })
  }
}
