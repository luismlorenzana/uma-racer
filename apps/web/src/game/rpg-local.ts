// Local-first RPG account and campaign (docs/design/uma-rpg.md, D263). Every change commits to Dexie with its outbox
// markers in one transaction and syncs in the background like races and the Farm; nothing waits on the server.
import {
  RPG_PARTY_SIZE, RPG_PRESET_COUNT, applyBattleAction, canUseRpgSignature, changeRpgClass, createBattle, createRpgRun,
  enrollRpgOutfit as enrollProfile, inspirationGrantId, inspirationTokenId, parseInspirationBank, promoteRpgOutfit,
  replayBattle, repayInspiration, rpgBeginRunBattle, rpgPresetId, rpgRestAtCamp, rpgRunId, rpgSettleRunBattle, rpgSkillKey,
  spendRpgTreePoint, validateRpgLoadout,
  type BattleAction, type BattleStep, type InspirationMovement, type RpgBattleResultV2, type RpgCampaignChapter,
  type RpgElement, type RpgOutfitSaveV1, type RpgPresetSaveV1, type RpgPresetSlotV1, type RpgProfile, type RpgRunSaveV2,
  type RpgSettlement, type RpgSkillRef, type RpgWeapon, type Strategy, type UmaTemplate,
} from '@racer/domain'
import { db, type VersionedRow } from './db'
import { queueInTransaction } from './persistence'

export interface RpgAccount {
  outfits: ReadonlyMap<string, VersionedRow<RpgOutfitSaveV1>>
  /** Always five, projected empty until first saved. */
  presets: readonly VersionedRow<RpgPresetSaveV1>[]
  runs: readonly VersionedRow<RpgRunSaveV2>[]
}

export function emptyRpgPreset(index: number): RpgPresetSaveV1 {
  return { schemaVersion: 2, presetId: rpgPresetId(index), name: `Party ${index}`, slots: [null, null, null, null, null], foregroundChapterId: null }
}

export async function readRpgAccount(): Promise<RpgAccount> {
  const [outfits, saved, runs] = await Promise.all([db.rpgOutfits.toArray(), db.rpgPresets.toArray(), db.rpgCheckpoints.toArray()])
  const byId = new Map(saved.map((row) => [row.id, row]))
  return {
    outfits: new Map(outfits.map((row) => [row.id, row])),
    presets: Array.from({ length: RPG_PRESET_COUNT }, (_, i) => byId.get(rpgPresetId(i + 1)) ?? { id: rpgPresetId(i + 1), version: 0, data: emptyRpgPreset(i + 1) }),
    runs: runs.filter((row) => row.data.schemaVersion === 2),
  }
}

export function validateRpgPresetSlots(slots: readonly (RpgPresetSlotV1 | null)[], profiles: ReadonlyMap<string, RpgProfile>): string | null {
  if (slots.length !== RPG_PARTY_SIZE) return 'A party has exactly five slots.'
  const ids = slots.flatMap((slot) => slot ? [slot.outfitId] : [])
  if (new Set(ids).size !== ids.length) return 'An outfit can fill only one slot.'
  for (const slot of slots) {
    if (!slot) continue
    const profile = profiles.get(slot.outfitId)
    if (!profile) return 'Every slot needs an enrolled outfit.'
    if (!canUseRpgSignature(profile, slot.signature) || !validateRpgLoadout(profile, slot.signature, slot.loadout)) return 'A slot has an unusable element or skill.'
  }
  return null
}

const now = () => Date.now()

export async function enrollRpgOutfit(input: { template: UmaTemplate; contentVersion: string; style: Strategy; weapon: RpgWeapon; signature: RpgElement }): Promise<void> {
  const profile = enrollProfile({ outfit: input.template, contentVersion: input.contentVersion, style: input.style, weapon: input.weapon, defaultSignature: input.signature })
  await db.transaction('rw', [db.umas, db.rpgOutfits, db.pendingRpgCommands, db.outbox], async () => {
    if (!await db.umas.get(input.template.id)) throw new Error('Only owned outfits can enroll')
    if (await db.rpgOutfits.get(input.template.id)) throw new Error('Already enrolled')
    await db.rpgOutfits.put({ id: input.template.id, version: 0, data: { schemaVersion: 2, profile, projectionRevision: 0 } })
    await queueInTransaction('rpgOutfits', input.template.id, 'upsert', now())
  })
}

async function putOutfit(row: VersionedRow<RpgOutfitSaveV1>, profile: RpgProfile, at: number): Promise<void> {
  await db.rpgOutfits.put({ ...row, data: { schemaVersion: 2, profile, projectionRevision: row.data.projectionRevision + 1 } })
  await queueInTransaction('rpgOutfits', row.id, 'upsert', at)
}
async function putPreset(id: string, data: RpgPresetSaveV1, at: number): Promise<void> {
  const row = await db.rpgPresets.get(id)
  await db.rpgPresets.put({ id, version: row?.version ?? 0, data: { ...data, schemaVersion: 2 } })
  await queueInTransaction('rpgPresets', id, 'upsert', at)
}

export async function saveRpgParty(preset: RpgPresetSaveV1): Promise<void> {
  await db.transaction('rw', [db.rpgOutfits, db.rpgPresets, db.pendingRpgCommands, db.outbox], async () => {
    const outfits = await db.rpgOutfits.toArray()
    const problem = validateRpgPresetSlots(preset.slots, new Map(outfits.map((row) => [row.id, row.data.profile])))
    if (problem) throw new Error(problem)
    // An outfit belongs to one party at a time; moving it here takes it out of the other.
    const at = now()
    for (const other of await db.rpgPresets.toArray()) {
      if (other.id === preset.presetId) continue
      const slots = other.data.slots.map((slot) => slot && preset.slots.some((s) => s?.outfitId === slot.outfitId) ? null : slot)
      if (slots.some((slot, i) => slot !== other.data.slots[i])) await putPreset(other.id, { ...other.data, slots: slots as RpgPresetSaveV1['slots'] }, at)
    }
    await putPreset(preset.presetId, preset, at)
  })
}

async function editOutfit(outfitId: string, edit: (profile: RpgProfile) => RpgProfile): Promise<void> {
  await db.transaction('rw', [db.rpgOutfits, db.pendingRpgCommands, db.outbox], async () => {
    const row = await db.rpgOutfits.get(outfitId)
    if (!row) throw new Error('Outfit is not enrolled')
    await putOutfit(row, edit(row.data.profile), now())
  })
}
export const learnRpgSkill = (outfitId: string, ref: RpgSkillRef) => editOutfit(outfitId, (p) => spendRpgTreePoint(p, ref))
export const changeRpgOutfitClass = (outfitId: string, style: Strategy, weapon: RpgWeapon) => editOutfit(outfitId, (p) => changeRpgClass(p, style, weapon))

/** Equips skills and the active element for the outfit's slot in one party. */
export async function equipRpgSkills(presetId: string, outfitId: string, signature: RpgElement, loadout: readonly RpgSkillRef[]): Promise<void> {
  const refs = loadout.map(({ tier, weapon, element, depth, branch }) => ({ tier, weapon, element, depth, branch }))
  await db.transaction('rw', [db.rpgOutfits, db.rpgPresets, db.pendingRpgCommands, db.outbox], async () => {
    const outfit = await db.rpgOutfits.get(outfitId)
    const preset = await db.rpgPresets.get(presetId)
    if (!outfit || !preset) throw new Error('Party member unavailable')
    if (!validateRpgLoadout(outfit.data.profile, signature, refs)) throw new Error('Those skills or that element are not usable')
    const slots = preset.data.slots.map((s) => s?.outfitId === outfitId ? { ...s, signature, loadout: refs } : s) as RpgPresetSaveV1['slots']
    await putPreset(presetId, { ...preset.data, slots }, now())
  })
}

export async function promoteRpgOutfitTier(outfitId: string, legacy: readonly RpgSkillRef[], discardUnspent: boolean): Promise<void> {
  await db.transaction('rw', [db.rpgOutfits, db.rpgPresets, db.rpgPromotions, db.pendingRpgCommands, db.outbox], async () => {
    const row = await db.rpgOutfits.get(outfitId)
    if (!row) throw new Error('Outfit is not enrolled')
    const before = row.data.profile
    const promoted = promoteRpgOutfit(before, legacy, discardUnspent)
    const at = now()
    await putOutfit(row, promoted.profile, at)
    const keys = new Set(promoted.profile.legacy.map(rpgSkillKey))
    for (const preset of await db.rpgPresets.toArray()) {
      if (!preset.data.slots.some((s) => s?.outfitId === outfitId)) continue
      const slots = preset.data.slots.map((s) => s?.outfitId === outfitId ? { ...s, loadout: s.loadout.filter((r) => keys.has(rpgSkillKey(r))) } : s)
      await putPreset(preset.id, { ...preset.data, slots: slots as RpgPresetSaveV1['slots'] }, at)
    }
    const promotionId = `rpg-promote:${outfitId}:${before.tier}`
    await db.rpgPromotions.put({ id: promotionId, createdAt: at, data: { schemaVersion: 1, promotionId, outfitId, fromTier: before.tier,
      toTier: promoted.profile.tier, archive: promoted.archivedTier.tree, createdAt: at } })
    await queueInTransaction('rpgPromotions', promotionId, 'append', at)
  })
}

// --- Campaign runs -------------------------------------------------------------------------------------------------

async function partyFor(presetId: string): Promise<{ profile: RpgProfile; slot: RpgPresetSlotV1 }[]> {
  const preset = await db.rpgPresets.get(presetId)
  if (!preset || preset.data.slots.some((s) => s === null)) throw new Error('Fill all five party slots first')
  return Promise.all(preset.data.slots.map(async (slot) => {
    const row = await db.rpgOutfits.get(slot!.outfitId)
    if (!row) throw new Error('A party member is no longer enrolled')
    return { profile: row.data.profile, slot: slot! }
  }))
}

/** Opens (or creates) the party's run of a chapter and remembers it as the party's current chapter. */
export async function openRpgRun(presetId: string, chapterId: string): Promise<void> {
  await db.transaction('rw', [db.rpgPresets, db.rpgCheckpoints, db.pendingRpgCommands, db.outbox], async () => {
    const id = rpgRunId(presetId, chapterId)
    const at = now()
    if (!await db.rpgCheckpoints.get(id)) {
      await db.rpgCheckpoints.put({ id, version: 0, data: createRpgRun(presetId, chapterId, at) })
      await queueInTransaction('rpgCheckpoints', id, 'upsert', at)
    }
    const preset = await db.rpgPresets.get(presetId)
    if (preset && preset.data.foregroundChapterId !== chapterId) await putPreset(presetId, { ...preset.data, foregroundChapterId: chapterId }, at)
  })
}

async function putRun(run: RpgRunSaveV2, at: number): Promise<void> {
  const id = rpgRunId(run.presetId, run.chapterId)
  const row = await db.rpgCheckpoints.get(id)
  await db.rpgCheckpoints.put({ id, version: row?.version ?? 0, data: run })
  await queueInTransaction('rpgCheckpoints', id, 'upsert', at)
}
async function runFor(presetId: string, chapterId: string): Promise<RpgRunSaveV2> {
  const row = await db.rpgCheckpoints.get(rpgRunId(presetId, chapterId))
  return row?.data ?? createRpgRun(presetId, chapterId, now())
}

export async function restRpgRun(chapter: RpgCampaignChapter, presetId: string, campId: string): Promise<void> {
  await db.transaction('rw', [db.rpgCheckpoints, db.pendingRpgCommands, db.outbox], async () => {
    const at = now()
    await putRun(rpgRestAtCamp(chapter, await runFor(presetId, chapter.id), campId, at), at)
  })
}

export async function beginRpgFight(chapter: RpgCampaignChapter, presetId: string, nodeId: string): Promise<string> {
  return db.transaction('rw', [db.rpgOutfits, db.rpgPresets, db.rpgCheckpoints, db.rpgFights, db.pendingRpgCommands, db.outbox], async () => {
    const at = now()
    const run = rpgBeginRunBattle(chapter, await runFor(presetId, chapter.id), nodeId, await partyFor(presetId), at)
    await putRun(run, at)
    await db.rpgFights.put({ id: run.battle!.battleId, actions: [], updatedAt: at })
    return run.battle!.battleId
  })
}

export interface RpgFightView { run: RpgRunSaveV2; step: BattleStep; actions: BattleAction[] }

/** The open fight replayed from its journal; a lost journal restarts the same frozen fight. */
export async function readRpgFight(presetId: string, chapterId: string): Promise<RpgFightView | null> {
  const run = (await db.rpgCheckpoints.get(rpgRunId(presetId, chapterId)))?.data
  if (!run?.battle) return null
  const journal = await db.rpgFights.get(run.battle.battleId)
  const actions = journal?.actions ?? []
  const step = replayBattle(run.battle.input, actions)
  return step.error ? { run, step: createBattle(run.battle.input), actions: [] } : { run, step, actions }
}

export async function actRpgFight(presetId: string, chapterId: string, battleId: string, expected: number, action: BattleAction): Promise<BattleStep> {
  return db.transaction('rw', [db.rpgCheckpoints, db.rpgFights], async () => {
    const run = (await db.rpgCheckpoints.get(rpgRunId(presetId, chapterId)))?.data
    if (!run?.battle || run.battle.battleId !== battleId) throw new Error('That fight is no longer open')
    const journal = await db.rpgFights.get(battleId)
    const actions = journal?.actions ?? []
    if (actions.length !== expected) throw new Error('The fight changed; reopen it')
    const before = replayBattle(run.battle.input, actions)
    if (before.error) throw new Error('The saved fight could not be replayed')
    const step = applyBattleAction(before.state, action)
    if (step.error) throw new Error(`That action is not allowed: ${step.error}`)
    await db.rpgFights.put({ id: battleId, actions: [...actions, action], updatedAt: now() })
    return step
  })
}

/** Gross tokens first repay the matching Inspiration advance debt (D256); the rest lands in Items. */
async function grantTokens(result: RpgBattleResultV2, runId: string, at: number): Promise<void> {
  const bankRow = await db.inspirationBank.get('main')
  let bank = bankRow ? parseInspirationBank(bankRow.data) : null
  let bankChanged = false
  for (const kind of ['slot', 'skill'] as const) {
    const gross = result.tokens[kind]
    if (!gross) continue
    const itemId = inspirationTokenId(result.tokens.tier, kind)
    const settled = bank?.phase === 'active' ? repayInspiration(bank, itemId, gross) : { bank, debtPaid: 0, net: gross }
    if (settled.debtPaid) { bank = settled.bank; bankChanged = true }
    const stack = await db.items.get(itemId)
    await db.items.put({ id: itemId, version: stack?.version ?? 0,
      data: { itemId, quantity: (stack?.data.quantity ?? 0) + settled.net, updatedAt: at } })
    await queueInTransaction('items', itemId, 'upsert', at)
    const movement: InspirationMovement = { id: inspirationGrantId(result.resultId, kind), itemId, delta: gross, reason: 'rpg-inspiration',
      source: { kind: 'rpg-inspiration', entryId: result.resultId, attemptId: `rpg-run:${runId}`, tier: result.tokens.tier,
        tokenKind: kind, debtPaid: settled.debtPaid }, createdAt: at }
    await db.itemLedger.put({ id: movement.id, data: movement, createdAt: at })
    await queueInTransaction('itemLedger', movement.id, 'append', at)
  }
  if (bankRow && bank && bankChanged) {
    await db.inspirationBank.put({ ...bankRow, data: bank })
    await queueInTransaction('inspirationBank', 'main', 'upsert', at)
  }
}

/** Settles a finished fight: EXP, tokens and carried MP on a win; a loss just closes it for a free retry. */
export async function finishRpgFight(chapter: RpgCampaignChapter, presetId: string, battleId: string): Promise<RpgSettlement> {
  return db.transaction('rw', [db.rpgOutfits, db.rpgCheckpoints, db.rpgFights, db.rpgResults, db.items, db.itemLedger,
    db.inspirationBank, db.pendingRpgCommands, db.outbox], async () => {
    const run = await runFor(presetId, chapter.id)
    if (!run.battle || run.battle.battleId !== battleId) throw new Error('That fight is no longer open')
    const actions = (await db.rpgFights.get(battleId))?.actions ?? []
    const step = replayBattle(run.battle.input, actions)
    if (step.error || step.state.outcome === 'active') throw new Error('The fight is not finished')
    const rows = await Promise.all(run.battle.input.allies.map((a) => db.rpgOutfits.get(a.id)))
    if (rows.some((row) => !row)) throw new Error('A party member is no longer enrolled')
    const at = now()
    const settled = rpgSettleRunBattle(chapter, run, step.state, rows.map((row) => row!.data.profile), at)
    await putRun(settled.run, at)
    if (settled.outcome === 'win' && settled.result) {
      for (const [index, row] of rows.entries()) await putOutfit(row!, settled.profiles[index]!, at)
      await db.rpgResults.put({ id: settled.result.resultId, data: settled.result, createdAt: at })
      await queueInTransaction('rpgResults', settled.result.resultId, 'append', at)
      await grantTokens(settled.result, rpgRunId(presetId, chapter.id), at)
    }
    await db.rpgFights.delete(battleId)
    return settled
  })
}

/** Leaves the open fight with no reward; carried MP is what it was when the fight began. */
export async function abandonRpgFight(presetId: string, chapterId: string): Promise<void> {
  await db.transaction('rw', [db.rpgCheckpoints, db.rpgFights, db.pendingRpgCommands, db.outbox], async () => {
    const run = await runFor(presetId, chapterId)
    if (!run.battle) return
    const at = now()
    await db.rpgFights.delete(run.battle.battleId)
    await putRun({ ...run, battle: null, updatedAt: at }, at)
  })
}

export const rpgOutfitProfiles = (account: RpgAccount): Map<string, RpgProfile> =>
  new Map([...account.outfits].map(([id, row]) => [id, row.data.profile]))
