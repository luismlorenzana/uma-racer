// Protected generation migration, never called by ordinary sync (technical §6, T120).
import { FARM_KITCHEN_CATALOGUE } from './catalogue'
import { createFarmExtraBlock } from './extra-map'
import { createFarmKitchen, createFarmKitchenWorker, emptyFarmRecipes } from './production'
import { farmCohortPageId, farmLegacyPageId, farmExtraRowId, parseFarmCutoverControl, parseFarmCutoverPage,
  parseFarmStoredEntity, type FarmCutoverControlV1, type FarmCutoverPageV1 } from './records'
import { FARM_CUTOVER_LIMITS, farmCutoverReceiptId, parseFarmCutoverRequest, parseFarmCutoverReceipt,
  type FarmCutoverRequest, type FarmCutoverReceipt } from './cutover-records'
import { clearFarmRetiredExtra, farmCutoverPages, farmCutoverSource, farmRetiredExtra } from './cutover-source'
import { farmArchiveDigest, farmBytes, farmCanonical, farmData, farmHash, farmKey, FARM_SYNC_LIMITS,
  type FarmStoredEntity, type FarmStoredLog } from './wire'
import { farmExactKeys, farmRecord } from './rules'

export interface FarmCutoverResponse {
  status: 'disabled' | 'recoverable-error' | FarmCutoverControlV1['phase']; message: string | null;
  entities: FarmStoredEntity[]; receipt: FarmCutoverReceipt | null
}
export const farmCutoverUnavailable = (message: string): FarmCutoverResponse =>
  ({ status: 'recoverable-error', message: message.slice(0, 240), entities: [], receipt: null })
export const farmCutoverDisabled = (): FarmCutoverResponse => ({ status: 'disabled', message: null, entities: [], receipt: null })
export function parseFarmCutoverResponse(value: unknown): FarmCutoverResponse | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['status', 'message', 'entities', 'receipt']) || !Array.isArray(value.entities) ||
    value.entities.length > 8 || farmBytes(value) > FARM_SYNC_LIMITS.responseBytes) return null
  if (value.status === 'disabled' || value.status === 'recoverable-error') return value.entities.length === 0 && value.receipt === null &&
    (value.status === 'disabled' ? value.message === null : typeof value.message === 'string' && value.message.length > 0 && value.message.length <= 240)
    ? structuredClone(value) as unknown as FarmCutoverResponse : null
  if (!['preparing', 'resetting', 'active'].includes(String(value.status)) || value.message !== null) return null
  const entities = value.entities.map(parseFarmStoredEntity)
  if (entities.some(e => !e) || new Set(entities.map(e => farmKey(e!))).size !== entities.length) return null
  const control = parseFarmCutoverControl(entities.find(e => e?.kind === 'farmCutover' && e.id === 'main')?.data)
  const receipt = value.receipt === null ? null : parseFarmCutoverReceipt(value.receipt)
  if (!control || control.phase !== value.status || value.receipt !== null && (!receipt || receipt.generation !== control.generation ||
    receipt.archiveDigest !== control.archiveDigest || receipt.cohortDigest !== control.cohortDigest)) return null
  return { status: control.phase, message: null, entities: entities as FarmStoredEntity[], receipt }
}
export const farmCutoverControl = (entities: ReadonlyMap<string, FarmStoredEntity>): FarmCutoverControlV1 | null => {
  const raw = entities.get('farmCutover/main')
  if (!raw) return null
  const control = !raw.deleted && parseFarmStoredEntity(raw) && parseFarmCutoverControl(raw.data)
  if (!control) throw new Error('Invalid Farm control; export and recover without restoring old progress')
  return control
}
const cohortPage = (entities: ReadonlyMap<string, FarmStoredEntity>, c: FarmCutoverControlV1, index: number) => {
  const raw = entities.get(`farmCutoverPages/${farmCohortPageId(c.generation, index)}`)
  const page = raw && !raw.deleted && parseFarmStoredEntity(raw) && parseFarmCutoverPage(raw.data)
  if (!page || page.type !== 'cohort' || page.generation !== c.generation || page.index !== index ||
    page.outfits.length !== Math.min(32, c.outfitCount - index * 32)) throw new Error('Frozen Farm cohort page is missing or malformed; Retry/Export')
  return page
}
/** Every post-freeze call reads exact bounded targets, never the changing roster. */
export function farmCutoverReferences(entities: ReadonlyMap<string, FarmStoredEntity>, request: FarmCutoverRequest): { entities: string[]; logs: string[] } {
  const c = farmCutoverControl(entities), entityKeys = new Set(['farmCutover/main', 'constellationBank/main', 'inspirationBank/main']), logKeys = new Set<string>()
  if (!c) return { entities: [...entityKeys, 'profile/main', 'farm/main'], logs: [] }
  const addReceipt = (action: FarmCutoverReceipt['action'], index: number | null = null) => logKeys.add(`farmOperations/${farmCutoverReceiptId(c.generation, action, index)}`)
  addReceipt('prepare')
  if (request.action === 'advance') {
    entityKeys.add(`farmCutoverPages/${farmCohortPageId(c.generation, Math.floor(request.index / 32))}`)
    const page = entities.get(`farmCutoverPages/${farmCohortPageId(c.generation, Math.floor(request.index / 32))}`)
    if (page) {
      const p = cohortPage(entities, c, Math.floor(request.index / 32)), outfit = p.outfits[request.index % 32]
      if (outfit) {
        entityKeys.add(`umas/${outfit.outfitId}`); entityKeys.add(`farmWorkers/${outfit.outfitId}`)
        FARM_KITCHEN_CATALOGUE.blocks.forEach(b => entityKeys.add(`farmExtra/${farmExtraRowId(outfit.outfitId, b)}`))
      }
    }
    addReceipt('advance', request.index)
  } else if (request.action === 'verify') {
    entityKeys.add(`farmCutoverPages/${farmCohortPageId(c.generation, request.index)}`)
    for (let i = request.index * 32; i < Math.min(c.outfitCount, (request.index + 1) * 32); i++) addReceipt('advance', i)
    addReceipt('verify', request.index)
  }
  if (request.action === 'finalize' || c.phase === 'active') {
    entityKeys.add(`farmCutoverPages/${farmLegacyPageId(c.generation)}`); entityKeys.add('farm/main')
    FARM_KITCHEN_CATALOGUE.blocks.forEach(b => entityKeys.add(`farmRecipes/b${b}`))
    addReceipt('finalize')
    if (request.action === 'finalize') for (let i = 0; i < c.pageCount; i++) addReceipt('verify', i)
  }
  if (entityKeys.size + logKeys.size > FARM_SYNC_LIMITS.documents) throw new Error('Farm reset read bounds exceeded')
  return { entities: [...entityKeys], logs: [...logKeys] }
}
export interface FarmCutoverContext {
  enabled: boolean; accountId: string; now: number; entities: ReadonlyMap<string, FarmStoredEntity>; logs: ReadonlyMap<string, FarmStoredLog>;
  /** SHA-256 of farmCutoverSource, validated at the common authoritative I/O boundary. Only initial prepare needs it. */
  sourceDigest?: string
}
export function resolveFarmCutover(context: FarmCutoverContext, raw: FarmCutoverRequest) {
  const writes: FarmStoredEntity[] = [], appends: FarmStoredLog[] = []
  const failure = (message: string) => ({ writes: [], appends: [], response: farmCutoverUnavailable(message) })
  if (!context.enabled) return { writes, appends, response: farmCutoverDisabled() }
  try {
    const request = parseFarmCutoverRequest(raw)
    if (!request) throw new Error('Malformed Farm cutover request; preserve archive and retry')
    const { entities, logs, now } = context, priorControl = farmCutoverControl(entities)
    if (priorControl && priorControl.generation !== request.generation) throw new Error('Farm generation differs; keep receipts and export')
    const put = (kind: string, id: string, data: object) => {
      const prior = entities.get(`${kind}/${id}`), row = { kind, id, version: (prior?.version ?? 0) + 1, data: farmData(data), deleted: false, updatedAt: now }
      if (!parseFarmStoredEntity(row)) throw new Error(`Invalid/oversized Farm reset projection ${kind}/${id}`)
      writes.push(row); return row
    }
    const append = (c: FarmCutoverControlV1, action: FarmCutoverReceipt['action'], values: Partial<FarmCutoverReceipt> = {}) => {
      const receipt: FarmCutoverReceipt = { schemaVersion: 1, type: 'cutover', generation: c.generation, action,
        index: null, outfitId: null, sourceVersion: null, appliedVersion: null, resetBefore: null, proof: farmHash([c.cohortDigest, action]),
        cohortDigest: c.cohortDigest, archiveDigest: c.archiveDigest, createdAt: now, freezeProofs: null, ...values }
      if (!parseFarmCutoverReceipt(receipt)) throw new Error('Invalid reset receipt; preserve original state')
      const id = farmCutoverReceiptId(c.generation, action, receipt.index)
      if (logs.has(`farmOperations/${id}`)) throw new Error('Immutable reset receipt already exists')
      appends.push({ kind: 'farmOperations', id, data: farmData(receipt), createdAt: now }); return receipt
    }
    const accepted = (c: FarmCutoverControlV1, receipt: FarmCutoverReceipt | null, rows: FarmStoredEntity[] = writes) => {
      const response: FarmCutoverResponse = { status: c.phase, message: null,
        entities: [writes.find(r => r.kind === 'farmCutover') ?? entities.get('farmCutover/main')!, ...rows.filter(r => r.kind !== 'farmCutover')], receipt }
      if (!parseFarmCutoverResponse(response) || writes.length + appends.length > FARM_SYNC_LIMITS.documents)
        throw new Error('Farm reset transaction/response bounds exceeded')
      return { writes, appends, response }
    }
    const readReceipt = (c: FarmCutoverControlV1, action: FarmCutoverReceipt['action'], index: number | null = null) => {
      const rawLog = logs.get(`farmOperations/${farmCutoverReceiptId(c.generation, action, index)}`)
      if (!rawLog) return null
      const r = parseFarmCutoverReceipt(rawLog.data)
      if (!r || r.action !== action || r.index !== index || r.createdAt !== rawLog.createdAt || r.cohortDigest !== c.cohortDigest ||
        r.archiveDigest !== c.archiveDigest || r.generation !== c.generation) throw new Error('Divergent reset evidence; Retry/Export')
      return r
    }
    // Other protected migrations must finish independently. Never invoke them here.
    const puzzle = entities.get('constellationBank/main'), inspiration = entities.get('inspirationBank/main')
    if (puzzle && (puzzle.deleted || puzzle.data.phase !== 'active') || inspiration && (inspiration.deleted || !farmRecord(inspiration.data.cohort) ||
      !Array.isArray(inspiration.data.opened) || Object.keys(inspiration.data.cohort).some(id => !(inspiration.data.opened as unknown[]).includes(id))))
      throw new Error('Finish the existing Puzzle/Inspiration preparation before Farm; no progress changed')
    if (!priorControl) {
      if (request.action !== 'prepare') throw new Error('Verified whole-account archive required before Farm preparation')
      const source = farmCutoverSource(context.accountId, entities, logs), a = request.archive
      if (a.accountId !== context.accountId || a.profileCreatedAt !== source.profile.createdAt ||
        !farmArchiveDigest(context.sourceDigest) || a.sourceDigest !== context.sourceDigest)
        throw new Error('Archive source/account is stale; capture a fresh archive before preparing')
      const c: FarmCutoverControlV1 = { schemaVersion: 1, generation: request.generation, phase: 'preparing',
        cohortDigest: context.sourceDigest, archiveDigest: a.archiveDigest, outfitCount: source.outfits.length,
        pageCount: Math.ceil(source.outfits.length / FARM_CUTOVER_LIMITS.page), nextOutfitIndex: 0, createdAt: now, activatedAt: null }
      put('farmCutover', 'main', c)
      const pages = farmCutoverPages(source, c.generation)
      for (const page of pages) put('farmCutoverPages', farmCohortPageId(c.generation, page.type === 'cohort' ? page.index : 0), page)
      const legacy: FarmCutoverPageV1 = { schemaVersion: 1, generation: c.generation, type: 'legacy', stations: source.stations }
      const row = put('farmCutoverPages', farmLegacyPageId(c.generation), legacy)
      return accepted(c, append(c, 'prepare', { proof: farmHash([pages, legacy]), freezeProofs: { pages: pages.map(farmHash), legacy: farmHash(legacy) } }), [row])
    }
    const c = priorControl
    const freeze = readReceipt(c, 'prepare')
    if (!freeze || freeze.freezeProofs?.pages.length !== c.pageCount) throw new Error('Missing/malformed Farm freeze receipt; keep the save')
    if (c.phase === 'active' && (!readReceipt(c, 'finalize') || ['farm/main', ...FARM_KITCHEN_CATALOGUE.blocks.map(b => `farmRecipes/b${b}`)].some(k =>
      entities.get(k)?.deleted || entities.get(k)?.data.generation !== c.generation))) throw new Error('Active Farm receipt/projections disagree; export and recover')
    const frozenPage = (index: number) => {
      const page = cohortPage(entities, c, index)
      if (farmHash(page) !== freeze.freezeProofs!.pages[index]) throw new Error('Frozen Farm page changed; export and recover')
      return page
    }
    if (request.action === 'status') return accepted(c, c.phase === 'active' ? readReceipt(c, 'finalize') : null,
      c.phase === 'active' ? ['farm/main', ...FARM_KITCHEN_CATALOGUE.blocks.map(b => `farmRecipes/b${b}`)].map(k => {
        const row = entities.get(k); if (!row) throw new Error('Active Farm projection is missing; export and recover'); return row
      }) : [])
    if (request.action === 'prepare') {
      if (request.archive.accountId !== context.accountId || request.archive.archiveDigest !== c.archiveDigest || request.archive.sourceDigest !== c.cohortDigest)
        throw new Error('The original Farm archive proof is required; never refreeze a changing roster')
      return accepted(c, readReceipt(c, 'prepare'), [])
    }
    const old = readReceipt(c, request.action, 'index' in request ? request.index : null)
    if (old) return accepted(c, old, []) // Lost response: exact immutable receipt, never another reset.
    if (c.phase === 'active') throw new Error('Farm is already active; pull canonical state without resetting')
    if (request.action === 'advance') {
      if (request.index !== c.nextOutfitIndex || request.index >= c.outfitCount) throw new Error('Farm reset cursor changed; Retry from canonical control')
      const page = frozenPage(Math.floor(request.index / 32)), frozen = page.outfits[request.index % 32]!, uma = entities.get(`umas/${frozen.outfitId}`)
      if (!uma || uma.deleted || uma.version < frozen.sourceVersion || frozen.tiers.some(t => !farmRetiredExtra(uma.data).some(u => u.tier === t)))
        throw new Error('Frozen Farm outfit/scenario unavailable; preserve and recover')
      const before = farmRetiredExtra(uma.data), after = put('umas', uma.id, clearFarmRetiredExtra(uma.data))
      put('farmWorkers', uma.id, createFarmKitchenWorker(c.generation, uma.id))
      for (const block of FARM_KITCHEN_CATALOGUE.blocks) put('farmExtra', farmExtraRowId(uma.id, block), createFarmExtraBlock(c.generation, uma.id, block))
      const next = { ...c, phase: 'resetting' as const, nextOutfitIndex: c.nextOutfitIndex + 1 }; put('farmCutover', 'main', next)
      return accepted(next, append(c, 'advance', { index: request.index, outfitId: uma.id, sourceVersion: frozen.sourceVersion,
        appliedVersion: after.version, resetBefore: before, proof: farmHash([frozen, before, after.version]) }))
    }
    if (c.nextOutfitIndex !== c.outfitCount) throw new Error('Complete every frozen outfit before verification/finalization')
    if (request.action === 'verify') {
      if (request.index >= c.pageCount) throw new Error('Unknown Farm verification page')
      const page = frozenPage(request.index), receipts = page.outfits.map((outfit, offset) => {
        const r = readReceipt(c, 'advance', request.index * 32 + offset)
        if (!r || r.outfitId !== outfit.outfitId || r.sourceVersion !== outfit.sourceVersion ||
          r.proof !== farmHash([outfit, r.resetBefore, r.appliedVersion]) || outfit.tiers.some(t => !r.resetBefore?.some(unit => unit.tier === t)))
          throw new Error('Missing/mismatched Farm outfit step; Retry/Export, never activate')
        return r
      })
      return accepted(c, append(c, 'verify', { index: request.index, proof: farmHash(receipts) }), [])
    }
    for (let i = 0; i < c.pageCount; i++) if (!readReceipt(c, 'verify', i)) throw new Error('Verify every frozen Farm page before activation')
    const legacy = parseFarmCutoverPage(entities.get(`farmCutoverPages/${farmLegacyPageId(c.generation)}`)?.data)
    if (!legacy || legacy.type !== 'legacy' || legacy.generation !== c.generation || farmHash(legacy) !== freeze.freezeProofs!.legacy)
      throw new Error('Frozen legacy jobs missing/changed; keep the save')
    const farm = createFarmKitchen(c.generation)
    farm.stations = legacy.stations.filter(s => s.outfitId !== null || s.attempt > 0).map(s => ({ id: s.stationId, outfitId: s.outfitId, attempt: s.attempt, job: null }))
    put('farm', 'main', farm)
    for (const block of FARM_KITCHEN_CATALOGUE.blocks) put('farmRecipes', `b${block}`, emptyFarmRecipes(c.generation, block))
    const next = { ...c, phase: 'active' as const, activatedAt: now }; put('farmCutover', 'main', next)
    return accepted(next, append(c, 'finalize', { proof: farmHash([legacy, farm, c.pageCount]) }))
  } catch (error) { return failure(error instanceof Error ? error.message : 'Farm reset failed; keep archive and Retry/Export') }
}
