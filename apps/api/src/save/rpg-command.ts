// Atomic RPG command validation and resolution (docs/technical/uma-rpg-implementation.md, T090).
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { ENTITY_KINDS, LOG_KINDS, parseEntityData, parseLogData, saveEntityIdMatches, saveLogIdMatches,
  type EntityKind, type EntityRecord, type LogAppend, type LogKind, type LogRecord } from './save.types'
import { RPG_ACTIONS, RPG_MAX_GROUP_OPERATIONS, rpgExact, rpgId, rpgInt, rpgRecord,
  type RpgAction } from './rpg-save.types'
import { frozenReward, legalLoadout, oneTreePoint, progression, skillKey } from './rpg-progression'
import { parseInspirationBank, repayInspiration } from './inspiration-bank'

export interface RpgExpected { kind: EntityKind; id: string; version: number }
export interface RpgUpsert { kind: EntityKind; id: string; data: Record<string, unknown> }
export interface RpgCommandRequest {
  schemaVersion: 1
  commandId: string
  action: RpgAction
  expected: RpgExpected[]
  upserts: RpgUpsert[]
  appends: LogAppend[]
}
export interface RpgReceipt {
  schemaVersion: 1
  commandId: string
  action: RpgAction
  payloadHash: string
  applied: Array<{ kind: EntityKind; id: string; version: number }>
  appendedIds: string[]
  createdAt: number
}
export type RpgCommandResponse =
  | { status: 'applied' | 'duplicate'; receipt: RpgReceipt; entities: EntityRecord[]; logs: LogRecord[] }
  | { status: 'conflict'; authoritative: Array<{ kind: EntityKind; id: string; record: EntityRecord | null }> }
  | { status: 'rejected'; reason: string }

const entityKey = (kind: EntityKind, id: string) => `${kind}/${id}`
const logKey = (kind: LogKind, id: string) => `${kind}/${id}`
const allowedEntities: Record<RpgAction, readonly EntityKind[]> = {
  enroll: ['rpgOutfits'], 'edit-preset': ['rpgPresets'], 'edit-outfit': ['rpgOutfits'], 'start-chapter': ['rpgCheckpoints', 'rpgPresets'],
  'choose-node': ['rpgCheckpoints', 'items', 'inspirationBank'], 'begin-battle': ['rpgCheckpoints'], takeover: ['rpgCheckpoints'],
  'battle-result': ['rpgCheckpoints', 'rpgOutfits'], 'clear-chapter': ['rpgCheckpoints', 'items', 'inspirationBank'],
  promote: ['rpgOutfits', 'rpgPresets'], 'spend-inspiration': ['umas', 'items'],
}
const allowedLogs: Record<RpgAction, readonly LogKind[]> = {
  enroll: [], 'edit-preset': [], 'edit-outfit': [], 'start-chapter': [], 'begin-battle': [], takeover: [],
  'choose-node': ['itemLedger'], 'battle-result': ['rpgResults'], 'clear-chapter': ['itemLedger'],
  promote: ['rpgPromotions'], 'spend-inspiration': ['itemLedger'],
}

export function parseRpgCommandRequest(body: unknown): RpgCommandRequest | string {
  if (!rpgRecord(body) || !rpgExact(body, ['schemaVersion', 'commandId', 'action', 'expected', 'upserts', 'appends'])) {
    return 'RPG command must have exact versioned fields'
  }
  if (body.schemaVersion !== 1 || !rpgId(body.commandId) || !RPG_ACTIONS.includes(body.action as RpgAction)) {
    return 'Unsupported RPG command version, id or action'
  }
  const action = body.action as RpgAction
  if (!Array.isArray(body.expected) || !Array.isArray(body.upserts) || !Array.isArray(body.appends) ||
    body.expected.length + body.upserts.length + body.appends.length > RPG_MAX_GROUP_OPERATIONS ||
    body.upserts.length === 0) return 'Invalid RPG command operation count'
  const expected: RpgExpected[] = []
  for (const entry of body.expected) {
    if (!rpgRecord(entry) || !rpgExact(entry, ['kind', 'id', 'version']) ||
      !ENTITY_KINDS.includes(entry.kind as EntityKind) || !rpgId(entry.id) || !rpgInt(entry.version)) return 'Invalid RPG expected row'
    expected.push(entry as unknown as RpgExpected)
  }
  const upserts: RpgUpsert[] = []
  for (const entry of body.upserts) {
    if (!rpgRecord(entry) || !rpgExact(entry, ['kind', 'id', 'data']) ||
      !ENTITY_KINDS.includes(entry.kind as EntityKind) || !allowedEntities[action].includes(entry.kind as EntityKind) ||
      !rpgId(entry.id)) return 'Invalid RPG entity operation'
    const kind = entry.kind as EntityKind
    const data = parseEntityData(kind, entry.data)
    if (!data || !saveEntityIdMatches(kind, entry.id, data)) return 'Invalid RPG entity data or identity'
    upserts.push({ kind, id: entry.id, data })
  }
  const appends: LogAppend[] = []
  for (const entry of body.appends) {
    if (!rpgRecord(entry) || !rpgExact(entry, ['kind', 'id', 'data', 'createdAt']) ||
      !LOG_KINDS.includes(entry.kind as LogKind) || !allowedLogs[action].includes(entry.kind as LogKind) ||
      !rpgId(entry.id) || !rpgInt(entry.createdAt)) return 'Invalid RPG log operation'
    const kind = entry.kind as LogKind
    const data = parseLogData(kind, entry.data)
    if (!data || !saveLogIdMatches(kind, entry.id, data, entry.createdAt)) return 'Invalid RPG log data or identity'
    appends.push({ kind, id: entry.id, data, createdAt: entry.createdAt })
  }
  const expectedKeys = expected.map((entry) => entityKey(entry.kind, entry.id))
  const entityKeys = upserts.map((entry) => entityKey(entry.kind, entry.id))
  const logKeys = appends.map((entry) => logKey(entry.kind, entry.id))
  if (new Set(expectedKeys).size !== expectedKeys.length || new Set(entityKeys).size !== entityKeys.length ||
    new Set(logKeys).size !== logKeys.length || new Set(appends.map((entry) => entry.id)).size !== appends.length ||
    entityKeys.some((key) => !expectedKeys.includes(key))) {
    return 'RPG command has duplicate or unversioned operations'
  }
  if (action === 'enroll' && (upserts.length !== 1 || upserts[0]?.kind !== 'rpgOutfits' ||
    !expectedKeys.includes(entityKey('umas', upserts[0].id)))) return 'Enrollment needs one outfit and owned Uma version'
  if (action === 'edit-preset') {
    if (upserts.length !== 1 || upserts[0]?.kind !== 'rpgPresets') return 'Preset edit needs one preset'
    const slots = upserts[0].data.slots as Array<{ outfitId: string } | null>
    if (slots.some((slot) => slot && !expectedKeys.includes(entityKey('rpgOutfits', slot.outfitId)))) {
      return 'Preset edit needs versioned outfit dependencies'
    }
  }
  if (action === 'start-chapter' && (upserts.filter((row) => row.kind === 'rpgCheckpoints').length !== 1 ||
    !expectedKeys.includes(entityKey('rpgPresets', upserts.find((row) => row.kind === 'rpgCheckpoints')?.data.presetId as string)))) {
    return 'Chapter start needs a versioned preset'
  }
  if (['choose-node', 'begin-battle', 'takeover', 'battle-result', 'clear-chapter'].includes(action) &&
    upserts.filter((row) => row.kind === 'rpgCheckpoints').length !== 1) return 'Command needs one checkpoint'
  if (action === 'begin-battle') {
    const data = upserts.find((row) => row.kind === 'rpgCheckpoints')!.data
    if (!rpgRecord(data.frozenEntry) || !Array.isArray(data.frozenEntry.party)) return 'Battle entry lacks a frozen party'
    if (data.frozenEntry.retryOrdinal === 0 &&
      (!expectedKeys.includes(entityKey('rpgPresets', data.presetId as string)) ||
        data.frozenEntry.party.some((member: unknown) => !rpgRecord(member) ||
          !expectedKeys.includes(entityKey('rpgOutfits', member.outfitId as string))))) {
      return 'Battle entry needs versioned preset and all five outfits'
    }
  }
  if (action === 'battle-result' && appends.filter((entry) => entry.kind === 'rpgResults').length !== 1) return 'Battle result evidence required'
  if (action === 'promote' && appends.filter((entry) => entry.kind === 'rpgPromotions').length !== 1) return 'Promotion evidence required'
  if (action === 'promote' && upserts.filter((r) => r.kind === 'rpgOutfits').length !== 1) return 'Promotion needs one outfit'
  if (action === 'edit-outfit' && (upserts.length !== 1 || upserts[0]?.kind !== 'rpgOutfits')) return 'Tree edit needs one outfit'
  if (action === 'spend-inspiration' && (upserts.length !== 2 || upserts.filter(r => r.kind === 'umas').length !== 1 ||
    upserts.filter(r => r.kind === 'items').length !== 1 || appends.length !== 1)) return 'Inspiration spend needs one Uma, stack and movement'
  return { schemaVersion: 1, commandId: body.commandId, action, expected, upserts, appends }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (rpgRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  return value
}
export function rpgPayloadHash(request: RpgCommandRequest): string {
  return createHash('sha256').update(JSON.stringify(stable(request))).digest('hex')
}

export function rpgEncounterSeed(uid: string, presetId: string, chapterId: string, attemptIndex: number, nodeId: string): string {
  const identity = `${uid}:rpg-entry:${presetId}:${chapterId}:${attemptIndex}:${nodeId}`
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function checkpoint(request: RpgCommandRequest): Record<string, unknown> | null {
  return request.upserts.find((row) => row.kind === 'rpgCheckpoints')?.data ?? null
}
function currentCheckpoint(request: RpgCommandRequest, existing: Map<string, EntityRecord>): Record<string, unknown> | null {
  const row = request.upserts.find((item) => item.kind === 'rpgCheckpoints')
  return row ? existing.get(entityKey(row.kind, row.id))?.data ?? null : null
}
function sameFrozen(previous: Record<string, unknown>, next: Record<string, unknown>, ignored: string[] = []): boolean {
  const a = { ...previous }
  const b = { ...next }
  for (const key of ignored) { delete a[key]; delete b[key] }
  return isDeepStrictEqual(a, b)
}

function itemDeltaValid(request: RpgCommandRequest, existing: Map<string, EntityRecord>, movement: Record<string, unknown>): boolean {
  const row = request.upserts.find(r => r.kind === 'items' && r.id === movement.itemId)
  const before = existing.get(`items/${movement.itemId}`)
  const source = movement.source as Record<string, unknown>
  const quantity = (before?.data.quantity as number ?? 0) + (movement.delta as number) - (source.kind === 'rpg-inspiration' ? source.debtPaid as number ?? 0 : 0)
  return !!row && !before?.deleted && Number.isSafeInteger(quantity) && quantity >= 0 &&
    row.data.quantity === quantity && row.data.updatedAt === movement.createdAt
}
function inspirationGrantError(request: RpgCommandRequest, cp: Record<string, unknown>, existing: Map<string, EntityRecord>): string | null {
  let reward: Record<string, unknown> | null = null
  if (cp.status === 'pending-result' && rpgRecord(cp.frozenEntry)) {
    try {
      const kit: unknown = JSON.parse(cp.frozenEntry.enemyKitJson as string)
      if (rpgRecord(kit) && kit.format === 'rpg-combat-kit-v3') {
        const v = kit.inspiration
        if (!rpgRecord(v) || !rpgExact(v, ['tier', 'slot', 'skill']) || !rpgInt(v.tier, 1) || v.tier > 14 ||
          ![0, 30].includes(v.slot as number) || !rpgInt(v.skill) || v.skill > 60) return 'Malformed token reward kit'
        reward = v
      }
    } catch { return 'Malformed token reward kit' }
  }
  const grants = request.appends.filter(a => a.kind === 'itemLedger')
  const expected = reward ? ['slot', 'skill'].filter(k => (reward![k] as number) > 0) : []
  if (grants.length !== expected.length || request.upserts.filter(u => u.kind === 'items').length !== expected.length) return 'Token reward operation count differs from frozen kit'
  if (request.action !== 'clear-chapter' && (reward?.slot as number ?? 0) > 0) return 'Boss tokens require chapter clear'
  const bankRow = existing.get('inspirationBank/main'), bankWrite = request.upserts.find(u => u.kind === 'inspirationBank')
  let bank = bankRow ? parseInspirationBank(bankRow.data) : null
  if (bankRow && (!bank || bankRow.deleted)) return 'Inspiration bank unavailable'
  if (expected.length && bankRow && (!request.expected.some(e => e.kind === 'inspirationBank' && e.id === 'main' && e.version === bankRow.version) || !bankWrite)) return 'Refresh the account to collect tokens against its Inspiration bank'
  if ((!expected.length || !bankRow) && bankWrite) return 'Unexpected Inspiration bank mutation'
  if (expected.length && bank?.phase === 'opening') return 'Resume the Inspiration advance before collecting tokens'
  for (const kind of expected) {
    const g = grants.find(a => a.data.itemId === `inspiration:t${reward!.tier}:${kind}`)?.data
    const settlement = repayInspiration(bank, `inspiration:t${reward!.tier}:${kind}`, reward![kind] as number)
    if (!g || !rpgRecord(g.source) || g.reason !== 'rpg-inspiration' || g.delta !== reward![kind] ||
      (g.source.debtPaid ?? 0) !== settlement.debtPaid ||
      g.source.entryId !== (cp.frozenEntry as Record<string, unknown>).entryId || g.source.attemptId !== cp.attemptId ||
      !itemDeltaValid(request, existing, g)) return 'Token reward differs from frozen entry or Item projection'
    bank = settlement.bank
  }
  if (bankWrite && !isDeepStrictEqual(bankWrite.data, bank)) return 'Inspiration bank projection differs from repayment'
  return null
}
function inspirationSpendError(request: RpgCommandRequest, existing: Map<string, EntityRecord>): string | null {
  const movement = request.appends[0]?.data, source = movement?.source
  if (!movement || movement.reason !== 'inspiration-unlock' || !rpgRecord(source)) return 'Inspiration spend evidence required'
  const row = request.upserts.find(u => u.kind === 'umas'), before = row && existing.get(`umas/${row.id}`)
  if (!row || !before || before.deleted || source.umaId !== row.id || before.data.schemaVersion !== 15 || row.data.schemaVersion !== 15 ||
    !itemDeltaValid(request, existing, movement)) return 'Inspiration spend needs current owned Uma and sufficient matching tokens'
  const runs = before.data.scenarios as Record<string, unknown>[]
  const run = runs.find(r => r.tier === source.tier)
  if (!run || !rpgRecord(run.inspiration)) return 'Scenario Inspiration unavailable'
  const slots = run.inspiration.slots as string[], golds = run.inspiration.golds as string[], node = source.nodeId as string
  // Slots and golds are the scenario's; who fills a slot is her selected preset's (D252).
  const presets = rpgRecord(run.presets) ? run.presets : null
  const build = presets && typeof before.data.activePreset === 'string' ? presets[before.data.activePreset] : null
  const assignments = rpgRecord(build) && rpgRecord(build.assignments) ? build.assignments : null
  let inspiration: Record<string, unknown>
  if (source.goldIndex === null) {
    const parent = ['parent0-gp0', 'parent0-gp1'].includes(node) ? 'parent0' : 'parent1'
    if (slots.includes(node) || node.includes('-gp') && !slots.includes(parent)) return 'Slot already open or parent is closed'
    const order = ['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1']
    inspiration = { slots: order.filter(s => slots.includes(s) || s === node), golds }
  } else {
    const key = `${node}:gold${source.goldIndex}`
    if (!slots.includes(node) || golds.includes(key) || !assignments || !rpgRecord(assignments[node]) ||
      assignments[node].kind !== 'lineage') return 'Gold already open or slot unfilled/closed'
    const order = ['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1'].flatMap(s => [0, 1].map(i => `${s}:gold${i}`))
    inspiration = { slots, golds: order.filter(g => golds.includes(g) || g === key) }
  }
  const expected = { ...before.data, scenarios: runs.map(r => r === run ? { ...r, inspiration } : r) }
  return isDeepStrictEqual(row.data, expected) ? null : 'Unlock changed fields other than one Inspiration position'
}

function semanticError(uid: string, request: RpgCommandRequest, existing: Map<string, EntityRecord>, logs: Map<string, LogRecord>): string | null {
  const next = checkpoint(request)
  const current = currentCheckpoint(request, existing)
  if (request.action === 'enroll') {
    const row = request.upserts[0]!
    if (existing.has(entityKey(row.kind, row.id))) return 'RPG outfit is already enrolled'
    const owned = existing.get(entityKey('umas', row.id))
    if (!owned || owned.deleted) return 'Outfit is not owned'
    const profile = row.data.profile as Record<string, unknown>
    if (profile.tier !== 1 || profile.level !== 1 || profile.exp !== 0 ||
      !Array.isArray(profile.tree) || profile.tree.length !== 0 ||
      !Array.isArray(profile.legacy) || profile.legacy.length !== 0 || row.data.projectionRevision !== 0) {
      return 'Enrollment must begin at RPG Tier 1 Lv1'
    }
  }
  if (request.action === 'edit-preset') {
    const row = request.upserts[0]!
    const slots = row.data.slots as Array<Record<string, unknown> | null>
    const previous = existing.get(`rpgPresets/${row.id}`)?.data
    const changed = previous && (previous.slots as Array<Record<string, unknown> | null>).some((old) => {
      const slot = slots.find((s) => s?.outfitId === old?.outfitId)
      return old && slot && (!isDeepStrictEqual(old.loadout, slot.loadout) || old.signature !== slot.signature)
    })
    if (changed && previous.foregroundChapterId) {
      const id = `${row.id}:${previous.foregroundChapterId}`
      const cp = existing.get(`rpgCheckpoints/${id}`)
      if (!request.expected.some((e) => e.kind === 'rpgCheckpoints' && e.id === id) || !cp ||
        !['at-checkpoint', 'cleared'].includes(cp.data.status as string)) return 'Loadout edit requires its accepted safe checkpoint'
    }
    if (slots.some((slot) => {
      if (!slot) return false
      const owned = existing.get(entityKey('rpgOutfits', slot.outfitId as string))
      const profile = owned?.data.profile
      return !owned || owned.deleted || !rpgRecord(profile) || !rpgRecord(profile.affinities) ||
        !profile.affinities[slot.signature as string] || !legalLoadout(profile, slot)
    })) return 'Preset contains an unowned or ineligible outfit'
  }
  if (request.action === 'start-chapter') {
    if (!next || (current && current.status !== 'cleared') || next.status !== 'at-checkpoint' || next.frozenEntry !== null) {
      return 'Chapter start is not a fresh checkpoint'
    }
    if (current ? next.attemptIndex !== (current.attemptIndex as number) + 1 ||
      next.revision !== (current.revision as number) + 1 : next.attemptIndex !== 1 || next.revision !== 0) {
      return 'Chapter attempt or revision is not the next value'
    }
    if (next.lastClearedNodeId !== null || !Array.isArray(next.selectedPath) || next.selectedPath.length !== 0) return 'Chapter start must reset the map'
    const presetId = next.presetId as string
    const party = existing.get(entityKey('rpgPresets', presetId))?.data
    if (!party || !Array.isArray(party.slots) || party.slots.some((slot) => slot === null)) return 'Chapter needs a complete preset'
    if (party.slots.some((slot) => !rpgRecord(slot) || !request.expected.some((row) =>
      row.kind === 'rpgOutfits' && row.id === slot.outfitId))) return 'Chapter needs versioned party outfits'
  }
  if (request.action === 'begin-battle') {
    if (!current || !next || current.status !== 'at-checkpoint' || next.status !== 'in-battle' ||
      next.revision !== (current.revision as number) + 1 || !rpgRecord(next.frozenEntry) ||
      !sameFrozen(current, next, ['revision', 'status', 'frozenEntry'])) return 'Battle must begin at checkpoint'
    const frozen = next.frozenEntry
    if (current.frozenEntry === null) {
      const party = existing.get(entityKey('rpgPresets', next.presetId as string))?.data
      if (!party || !Array.isArray(party.slots) || party.slots.some((slot) => !rpgRecord(slot)) ||
        !isDeepStrictEqual(party.slots.map((slot: Record<string, unknown>) => slot.outfitId),
          (frozen.party as Array<{ outfitId: string }>).map((member) => member.outfitId)) ||
        party.slots.some((slot: Record<string, unknown>, index: number) => {
          const member = (frozen.party as Array<{ signature: string }>)[index]
          return slot.signature !== member?.signature ||
            !existing.has(entityKey('rpgOutfits', slot.outfitId as string))
        })) return 'Frozen party differs from owned preset'
    }
    if (frozen.seed !== rpgEncounterSeed(uid, next.presetId as string, next.chapterId as string,
      next.attemptIndex as number, frozen.nodeId as string) ||
      (current.frozenEntry === null ? (frozen.retryOrdinal !== 0 || frozen.leaseRevision !== 0) :
        !isDeepStrictEqual(current.frozenEntry, frozen))) {
      return 'Encounter identity or seed changed'
    }
  }
  if (request.action === 'takeover') {
    if (!current || !next || current.status !== 'in-battle' || next.status !== 'in-battle' ||
      next.revision !== (current.revision as number) + 1 || !rpgRecord(current.frozenEntry) ||
      !rpgRecord(next.frozenEntry) ||
      next.frozenEntry.leaseRevision !== (current.frozenEntry.leaseRevision as number) + 1 ||
      !sameFrozen(current.frozenEntry, next.frozenEntry, ['leaseRevision']) ||
      !sameFrozen(current, next, ['revision', 'frozenEntry'])) return 'Takeover changed frozen encounter'
  }
  if (request.action === 'battle-result') {
    const evidence = request.appends.find((row) => row.kind === 'rpgResults')?.data
    if (!current || !next || current.status !== 'in-battle' || !rpgRecord(current.frozenEntry) ||
      !rpgRecord(next.frozenEntry) || !evidence || evidence.entryId !== current.frozenEntry.entryId ||
      evidence.retryOrdinal !== current.frozenEntry.retryOrdinal || evidence.contentHash !== current.contentHash ||
      evidence.contentVersion !== current.contentVersion ||
      next.revision !== (current.revision as number) + 1 ||
      !sameFrozen(current, next, ['revision', 'status', 'frozenEntry']) ||
      !Array.isArray(evidence.memberExp) ||
      !isDeepStrictEqual((evidence.memberExp as Array<{ outfitId: string }>).map((member) => member.outfitId).sort(),
        (current.frozenEntry.party as Array<{ outfitId: string }>).map((member) => member.outfitId).sort()) ||
      !sameFrozen(current.frozenEntry, next.frozenEntry, evidence.outcome === 'loss' ? ['retryOrdinal'] : []) ||
      next.status !== (evidence.outcome === 'win' ? 'pending-result' : 'at-checkpoint') ||
      (evidence.outcome === 'loss' && next.frozenEntry.retryOrdinal !== (current.frozenEntry.retryOrdinal as number) + 1)) {
      return 'Battle result does not match an open frozen entry'
    }
    for (const member of evidence.memberExp as Record<string, unknown>[]) {
      const entrant = (current.frozenEntry.party as Record<string, unknown>[]).find((m) => m.outfitId === member.outfitId)!
      if (member.delta !== frozenReward(current.frozenEntry.enemyKitJson as string, entrant, evidence.outcome === 'win')) return 'EXP differs from frozen encounter reward'
      const owned = existing.get(`rpgOutfits/${member.outfitId}`)
      const upsert = request.upserts.find((r) => r.kind === 'rpgOutfits' && r.id === member.outfitId)
      if (member.delta === 0 && !upsert) continue // Old unrewarded entries remain valid.
      if (!owned || owned.deleted || !rpgRecord(owned.data.profile) || !upsert || !rpgRecord(upsert.data.profile) ||
        !request.expected.some((r) => r.kind === 'rpgOutfits' && r.id === member.outfitId)) return 'Reward needs versioned outfit projections'
      const p = owned.data.profile, after = upsert.data.profile
      const settled = progression(p.level as number, p.exp as number, member.delta as number)
      if (!settled || member.beforeTier !== p.tier || member.beforeLevel !== p.level || member.beforeExp !== p.exp ||
        member.afterTier !== p.tier || member.afterLevel !== settled.level || member.afterExp !== settled.exp ||
        !isDeepStrictEqual(after, { ...p, ...settled }) ||
        upsert.data.projectionRevision !== (owned.data.projectionRevision as number) + 1) return 'Reward projection and evidence disagree'
    }
    if (request.upserts.some((r) => r.kind === 'rpgOutfits' && !(evidence.memberExp as Record<string, unknown>[])
      .some((m) => m.outfitId === r.id && (m.delta as number) > 0))) return 'Unexpected reward outfit mutation'
  }
  if (request.action === 'choose-node' || request.action === 'clear-chapter') {
    if (!current || !next || next.revision !== (current.revision as number) + 1 ||
      !sameFrozen(current, next, ['revision', 'status', 'frozenEntry', 'lastClearedNodeId', 'selectedPath']) ||
      next.frozenEntry !== null || !Array.isArray(current.selectedPath) || !Array.isArray(next.selectedPath) ||
      next.selectedPath.length !== current.selectedPath.length + 1 ||
      !isDeepStrictEqual(next.selectedPath.slice(0, -1), current.selectedPath) ||
      next.selectedPath.at(-1) !== next.lastClearedNodeId || current.selectedPath.includes(next.lastClearedNodeId)) return 'Map transition changed chapter identity or path'
    if (current.status === 'pending-result' && rpgRecord(current.frozenEntry)) {
      const entry = current.frozenEntry
      const result = logs.get(`rpgResults/${entry.entryId}:retry-${entry.retryOrdinal}`)?.data
      if (!result || result.outcome !== 'win' || result.contentHash !== current.contentHash ||
        result.contentVersion !== current.contentVersion || next.lastClearedNodeId !== entry.nodeId ||
        next.status !== (request.action === 'clear-chapter' ? 'cleared' : 'at-checkpoint')) return 'Map advance requires accepted winning evidence'
    } else if (request.action !== 'choose-node' || current.status !== 'at-checkpoint' ||
      current.frozenEntry !== null || next.status !== 'at-checkpoint') return 'Map node requires an accepted safe checkpoint'
    const error = inspirationGrantError(request, current, existing)
    if (error) return error
  }
  if (request.action === 'spend-inspiration') {
    const error = inspirationSpendError(request, existing)
    if (error) return error
  }
  if ((request.action === 'clear-chapter' || request.action === 'spend-inspiration') &&
    request.upserts.some((row) => row.kind === 'items') && !request.appends.some((row) => row.kind === 'itemLedger')) {
    return 'Item change requires its ledger evidence'
  }
  if (request.action === 'edit-outfit' || request.action === 'promote') {
    const row = request.upserts.find((r) => r.kind === 'rpgOutfits')!
    for (let index = 1; index <= 5; index++) {
      const id = `party-${index}`
      if (!request.expected.some((e) => e.kind === 'rpgPresets' && e.id === id)) return 'Outfit edit requires all five party dependencies'
      const preset = existing.get(`rpgPresets/${id}`)?.data
      if (preset && (preset.slots as Array<Record<string, unknown> | null>).some((s) => s?.outfitId === row.id) && preset.foregroundChapterId) {
        const cpId = `${id}:${preset.foregroundChapterId}`
        if (!request.expected.some((e) => e.kind === 'rpgCheckpoints' && e.id === cpId)) return 'Outfit edit requires foreground checkpoint dependency'
      }
    }
    for (const expected of request.expected.filter((e) => e.kind === 'rpgCheckpoints')) {
      const cp = existing.get(`rpgCheckpoints/${expected.id}`)?.data
      if (cp && !['at-checkpoint', 'cleared'].includes(cp.status as string)) return 'Skills and promotion require an accepted safe checkpoint'
    }
    const before = existing.get(entityKey(row.kind, row.id))?.data
    if (request.action === 'edit-outfit' && (!before || !rpgRecord(before.profile) || !rpgRecord(row.data.profile) ||
      row.data.projectionRevision !== (before.projectionRevision as number) + 1 || !oneTreePoint(before.profile, row.data.profile))) return 'Tree edit must spend exactly one earned point'
  }
  if (request.action === 'promote') {
    const row = request.upserts.find((r) => r.kind === 'rpgOutfits')!
    const before = existing.get(entityKey(row.kind, row.id))?.data
    const after = row.data
    const evidence = request.appends[0]?.data
    if (!before || !rpgRecord(before.profile) || !rpgRecord(after.profile) || !evidence ||
      before.profile.level !== 50 || after.profile.tier !== (before.profile.tier as number) + 1 ||
      after.profile.outfitId !== before.profile.outfitId ||
      after.projectionRevision !== (before.projectionRevision as number) + 1 ||
      !sameFrozen(before.profile, after.profile, ['tier', 'level', 'exp', 'tree', 'legacy']) ||
      evidence.outfitId !== row.id || evidence.fromTier !== before.profile.tier ||
      evidence.toTier !== after.profile.tier || !isDeepStrictEqual(evidence.archive, before.profile.tree)) {
      return 'Promotion does not match a mastered Lv50 outfit'
    }
    const settled = progression(1, 0, before.profile.exp as number)
    const learned = [...before.profile.tree as Record<string, unknown>[], ...before.profile.legacy as Record<string, unknown>[]]
    const legacy = after.profile.legacy as Record<string, unknown>[]
    if (!settled || after.profile.level !== settled.level || after.profile.exp !== settled.exp ||
      (after.profile.tree as unknown[]).length !== 0 || (after.profile.legacy as Record<string, unknown>[])
        .some((s) => !learned.some((known) => isDeepStrictEqual(s, known)))) return 'Promotion lost bank or invented legacy skills'
    for (const changed of request.upserts.filter((u) => u.kind === 'rpgPresets')) {
      const previous = existing.get(`rpgPresets/${changed.id}`)?.data
      if (!previous || !Array.isArray(previous.slots) || !Array.isArray(changed.data.slots)) return 'Promotion preset unavailable'
      const expectedSlots = previous.slots.map((slot: Record<string, unknown> | null) => slot?.outfitId === row.id
        ? { ...slot, loadout: (slot.loadout as Record<string, unknown>[]).filter((ref) =>
          legacy.some((s) => skillKey(s) === skillKey(ref))) } : slot)
      if (!isDeepStrictEqual(changed.data, { ...previous, slots: expectedSlots })) return 'Promotion may only prune unavailable legacy loadouts'
    }
    for (const dependency of request.expected.filter((e) => e.kind === 'rpgPresets')) {
      const previous = existing.get(`rpgPresets/${dependency.id}`)?.data
      if (!previous) continue
      const slots = (request.upserts.find((u) => u.kind === 'rpgPresets' && u.id === dependency.id)?.data ?? previous).slots as Array<Record<string, unknown> | null>
      if (slots.some((slot) => slot?.outfitId === row.id && !legalLoadout(after.profile as Record<string, unknown>, slot))) {
        return 'Promotion must prune unavailable skills from every party'
      }
    }
  }
  return null
}

/** Pure decision: repositories read all dependencies first, then apply every write or none. */
export function resolveRpgCommand(uid: string, request: RpgCommandRequest, entities: Map<string, EntityRecord>,
  logs: Map<string, LogRecord>, now: number): { response: RpgCommandResponse; writes: EntityRecord[]; appends: LogRecord[] } {
  const receiptKey = logKey('rpgReceipts', request.commandId)
  const previousReceipt = logs.get(receiptKey)
  const payloadHash = rpgPayloadHash(request)
  if (previousReceipt) {
    if (previousReceipt.data.payloadHash !== payloadHash) return { response: { status: 'rejected', reason: 'Command id reused with different payload' }, writes: [], appends: [] }
    const receipt = previousReceipt.data as unknown as RpgReceipt
    return { response: { status: 'duplicate', receipt, entities: [], logs: [] }, writes: [], appends: [] }
  }
  const stale = request.expected.some((row) => (entities.get(entityKey(row.kind, row.id))?.version ?? 0) !== row.version)
  if (stale) return { response: { status: 'conflict', authoritative: request.expected.map((row) => ({ kind: row.kind,
    id: row.id, record: entities.get(entityKey(row.kind, row.id)) ?? null })) }, writes: [], appends: [] }
  for (const append of request.appends) {
    if (logs.has(logKey(append.kind, append.id))) return { response: { status: 'rejected', reason: `Log id already claimed: ${append.kind}/${append.id}` }, writes: [], appends: [] }
  }
  const error = semanticError(uid, request, entities, logs)
  if (error) return { response: { status: 'rejected', reason: error }, writes: [], appends: [] }
  const writes = request.upserts.map((row): EntityRecord => ({ kind: row.kind, id: row.id,
    version: (entities.get(entityKey(row.kind, row.id))?.version ?? 0) + 1,
    data: row.data, deleted: false, updatedAt: now }))
  const appends = request.appends.map((row): LogRecord => ({ kind: row.kind, id: row.id, data: row.data, createdAt: row.createdAt }))
  const receipt: RpgReceipt = { schemaVersion: 1, commandId: request.commandId, action: request.action, payloadHash,
    applied: writes.map((row) => ({ kind: row.kind, id: row.id, version: row.version })),
    appendedIds: appends.map((row) => row.id), createdAt: now }
  appends.push({ kind: 'rpgReceipts', id: request.commandId, data: receipt as unknown as Record<string, unknown>, createdAt: now })
  return { response: { status: 'applied', receipt, entities: writes, logs: appends }, writes, appends }
}
