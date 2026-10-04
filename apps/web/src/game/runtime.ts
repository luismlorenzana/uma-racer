// Local-first save bootstrap and background sync (docs/technical/architecture.md).

import {
  cardNodeCapIssue,
  MAX_SYNC_OPERATIONS,
  assertProgressionRaceContent,
  assertScenarioGoalContent,
  assertRaceCourseContent,
  assertRaceSkillContent,
  assertSaveContent,
  badgeStateId,
  createTrainerBadgeState,
  createUmaBadgeState,
  createInitialSave,
  deriveUma,
  toggleExtraStat,
  trainedScenario,
  withScenarioView,
  constellationTemplate,
  isNodeUnlocked,
  lineageSlotEligibility,
  type ExtraStatNodeId,
  type NodeAssignment,
  type UmaSave,
  type DistanceCategory,
  type RacePreferences,
  parseSyncResponseOrThrow,
  SCENARIOS,
  replaceSkillLoadout as resolveSkillLoadout,
  type EntityKind,
  type EntityRecord,
  type LogKind,
  type SyncRequest,
  type RaceResultRecord,
  type Strategy,
  type BadgePreferences,
  type TrainerBadgePreferences,
  type FlairEventKind,
  type LedgerEntry,
  parseUmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { saveApi } from '../api/client'
import { flushOneRpgCommand } from './rpg-sync'
import { db } from './db'
import {
  adoptServerSnapshot,
  applyOwedDailyGrant,
  bootstrapGoalPlans,
  completeStarterSeed,
  entityRow,
  isDatabaseSemanticallyEmpty,
  isLegacyServerRecord,
  logRow,
  persistInitial,
  putConflict,
  queueInTransaction,
  readLocalSnapshot,
  reconcileFarmProjectionsInTransaction,
  stateFromSnapshot,
  updateEntityVersion,
} from './persistence'
import { adoptGameState, clearGameState, localDay, mergeBadgeAndFlairState, rememberLastSync, replaceBadgeState, replaceProfile, replaceRaceState, replaceTrainingState, replaceUma, setGameLifecycle, setSyncState, useGame } from './store'
import { replaceCardState } from './store'
import { acknowledgedSequences } from './sync'
import {
  completeMemoryRace,
  completePersistentRace,
  prepareMemoryRace,
  preparePersistentRace,
  readLatestRaceTimes,
  readRaceHistory,
  readUmaRaceHistory,
  type PreparedRace,
} from './racing'
import { setMemoryUmaDeck, setPersistentUmaDeck } from './decks'
import {
  type DevGrant,
  grantPersistentDevResources,
  grantOwedMaxCoupons,
  grantOwnerGifts,
  OWNER_GIFTS,
  type OwnerGift,
  exchangeMemoryUmaShards,
  exchangePersistentUmaShards,
  redeemMemoryCard,
  redeemMemoryUma,
  redeemPersistentCard,
  redeemPersistentUma,
  type CardRedemptionMutation,
  type UmaRedemptionMutation,
} from './collection'
import { replaceUmaCollectionState } from './store'
import {
  advanceMemoryUma,
  advancePersistentUma,
  startMemoryScenario,
  startPersistentScenario,
} from './promotion'
import {
  bootstrapBadgeFacts,
  bootstrapUmaFlair,
  updateTrainingBadgeFacts,
  evaluateUmaBadgeState,
  updateMemoryRaceBadgeFacts,
  badgeSubject,
  updateMemoryScenarioBadgeFacts,
} from './badges'
import {
  bootstrapTrainerBadgeState,
  pageMemoryFlairTimeline,
  persistBadgePreferences,
  readFlairTimelinePage,
  replaceMemoryBadgePreferences,
  type FlairTimelineCursor,
} from './badge-preferences'
import { reconcileTrainerMemory, reconcileTrainerPersistent, trainerAllowedAwardRefs } from './trainer'
import { installMinigameHost } from './minigame-host'
import { settleTrainingExpBank } from './training-bank'
import { installMinigameJournal } from './minigame-journal'
import { PersistentMinigameHost, PersistentMinigameJournal, retireBondRecallRuns, retireFiveStarFriendshipRuns } from './minigame-runs'
import { installFarmHost, MemoryFarmHost, PersistentFarmHost } from './farm/host'
import { ExtraStatConflictError, unlockPersistentExtraStat, type UnlockExtraStatReceipt } from './extra-stats'
import {
  LevelUpTicketsStaleError,
  spendPersistentLevelUpTickets,
  type LevelUpTicketsReceipt,
  type SpendLevelUpTicketsInput,
} from './training-level-up'

const toRecord = (value: object): Record<string, unknown> => value as unknown as Record<string, unknown>

/** Conflicts whose server copy predates the save schema this app writes (D156), read from the raw response. */
function legacyConflictKeys(value: unknown): Set<string> {
  const keys = new Set<string>()
  const conflicts = typeof value === 'object' && value !== null ? (value as Record<string, unknown>).conflicts : null
  if (!Array.isArray(conflicts)) return keys
  for (const conflict of conflicts) {
    const record = conflict as EntityRecord
    if (typeof record === 'object' && record !== null && isLegacyServerRecord(record)) keys.add(`${record.kind}/${record.id}`)
  }
  return keys
}

export class GameRuntime {
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private content: LoadedContent | null = null
  private uninstallMinigameHost: (() => void) | null = null
  private uninstallMinigameJournal: (() => void) | null = null
  private uninstallFarmHost: (() => void) | null = null
  private flushing = false
  private trainingLocks = new Set<string>()
  private raceLocks = new Set<string>()
  private promotionLocks = new Set<string>()
  private deckLocks = new Set<string>()
  private cardRedemptionLocks = new Set<string>()
  private umaRedemptionLocks = new Set<string>()
  private badgePreferenceLocks = new Set<string>()
  private unitLocks = new Set<string>()
  private exchangeLocked = false
  private memoryCardRedemptions = new Set<string>()
  private memoryUmaRedemptions = new Set<string>()
  private memoryExchangeSequence = 0
  private memoryRaceHistory: RaceResultRecord[] = []
  private onlineHandler = () => void this.flush()
  private visibilityHandler = () => {
    if (document.visibilityState === 'hidden') void this.flush()
  }

  /** Tests boot with no owner gifts (D209), so a gift never shows up in their saves. */
  constructor(private readonly ownerGifts: readonly OwnerGift[] = OWNER_GIFTS) {}

  async start(content: LoadedContent): Promise<void> {
    this.stop(false)
    const generation = this.generation
    this.content = content
    setGameLifecycle('booting')
    const today = localDay()
    const now = Date.now()
    try {
      assertSaveContent(content.umas.items, content.cards.items)
      assertRaceSkillContent(content.skills.items)
      assertProgressionRaceContent(content.races.items)
      assertScenarioGoalContent(content.umas.items, content.races.items)
      assertRaceCourseContent(content.races.items, content.courses.items)
    } catch (error) {
      setGameLifecycle('error', error instanceof Error ? error.message : String(error))
      return
    }
    try {
      await db.open()
    } catch (error) {
      if (generation !== this.generation) return
      if (error instanceof Error && error.name === 'VersionError') {
        setGameLifecycle('error', 'App update required for this local save database')
        return
      }
      try {
        const initial = createInitialSave(content.umas.items, content.cards.items, content.manifest.version, today, now)
        const evaluations = initial.umas.map((item) => evaluateUmaBadgeState(
          content,
          createUmaBadgeState(item, badgeSubject(content, item), now),
          { source: { kind: 'migration', id: null, tier: null }, earnedAt: now, retroactive: true },
        ))
        const umaBadges = evaluations.map((evaluation) => evaluation.state)
        const trainer = reconcileTrainerMemory({
          content,
          state: createTrainerBadgeState(now),
          umas: initial.umas,
          cards: initial.cards,
          badges: umaBadges,
          ledger: initial.ledger,
          raceResults: [],
          now,
          retroactive: true,
          sourceId: 'migration:trainer',
        })
        adoptGameState({
          profile: initial.profile,
          umas: Object.fromEntries(initial.umas.map((item) => [item.templateId, item])),
          cards: Object.fromEntries(initial.cards.map((item) => [item.templateId, item])),
          badges: Object.fromEntries([
            ...evaluations.map((evaluation) => [badgeStateId(evaluation.state.umaId), evaluation.state] as const),
            ['trainer', trainer.state] as const,
          ]),
          flairEvents: [...evaluations.flatMap((evaluation) => evaluation.events), ...trainer.events].map((event) => ({ id: event.id, ...event.data })),
          persistent: false,
        })
        this.uninstallFarmHost = installFarmHost(new MemoryFarmHost(new Set(initial.umas.map((item) => item.templateId))))
        setSyncState({
          status: 'error',
          error: `Local storage unavailable: ${error instanceof Error ? error.message : String(error)}`,
        })
      } catch (fallbackError) {
        setGameLifecycle('error', fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
      }
      return
    }

    this.uninstallMinigameHost = installMinigameHost(new PersistentMinigameHost(content, {
      publish: (mutation) => {
        if (generation !== this.generation) return
        if (mutation.card) replaceCardState(mutation.profile, mutation.card)
        else {
          replaceProfile(mutation.profile)
          if (mutation.uma) replaceUma(mutation.uma)
        }
      },
      afterMutation: async () => {
        if (generation !== this.generation) return
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      },
    }))
    this.uninstallMinigameJournal = installMinigameJournal(new PersistentMinigameJournal(content))
    this.uninstallFarmHost = installFarmHost(new PersistentFarmHost({
      afterMutation: async () => {
        if (generation !== this.generation) return
        await this.refreshPending()
        this.schedule()
      },
    }))

    try {
      let local = await readLocalSnapshot()
      if (!local) {
        if (!(await isDatabaseSemanticallyEmpty())) throw new Error('Local save is incomplete: profile/main is missing')
        let raw: unknown
        let loadedFromServer = false
        try {
          raw = await saveApi.load()
          loadedFromServer = true
        } catch {
          // First-run play may seed offline. The outbox reconciles when connectivity returns.
        }
        if (loadedFromServer) {
          const result = await adoptServerSnapshot(raw)
          if (result === 'adopted') local = await readLocalSnapshot()
        }
        if (!local) {
          await persistInitial(content, today, now)
          local = await readLocalSnapshot()
        }
      }
      if (generation !== this.generation) return
      await completeStarterSeed(content, now)
      await bootstrapGoalPlans(content, now)
      await bootstrapBadgeFacts(content, now)
      const archivedAwards = await bootstrapUmaFlair(content, now)
      await bootstrapTrainerBadgeState(now)
      const granted = await applyOwedDailyGrant(today, now)
      // Bond Recall is retired (D177): a run left open there gives its ticket back.
      const refunded = await retireBondRecallRuns(now, today)
      // Three stars (D200): a card run frozen for five gives its ticket back, and a card the migration maxed is paid its coupon.
      const refundedRuns = await retireFiveStarFriendshipRuns(now, today)
      const owedCoupons = await grantOwedMaxCoupons(now, today)
      const gift = await grantOwnerGifts(now, today, this.ownerGifts)
      // Linear Training Levels (D211, D212): what the v11 re-levelling carried past TL10 becomes Level-Up Tickets.
      const settled = await settleTrainingExpBank(now)
      const trainerArchive = await reconcileTrainerPersistent(content, now, true, 'migration:trainer')
      local = await readLocalSnapshot()
      if (!local) throw new Error('Save initialization did not produce a profile')
      if (generation !== this.generation) return
      adoptGameState(stateFromSnapshot(local, content, true))
      if (granted > 0) useGame.getState().pushToast(`+${granted} Daily tickets`, 'ticket')
      if (refunded > 0) useGame.getState().pushToast(`+${refunded} back from an unfinished Bond Recall run`, 'ticket')
      if (refundedRuns > 0) useGame.getState().pushToast(`+${refundedRuns} back from unfinished card training: cards now max at 3★`, 'ticket')
      if (owedCoupons > 0) useGame.getState().pushToast(`+${owedCoupons} Card Select Coupon${owedCoupons === 1 ? '' : 's'} for cards now at 3★`)
      if (gift.tickets > 0) useGame.getState().pushToast(`+${gift.tickets} tickets granted`, 'ticket')
      if (gift.cardCoupons > 0) useGame.getState().pushToast(`+${gift.cardCoupons} Card Select Coupon${gift.cardCoupons === 1 ? '' : 's'} granted`)
      if (gift.umaCoupons > 0) useGame.getState().pushToast(`+${gift.umaCoupons} Uma Select Coupon${gift.umaCoupons === 1 ? '' : 's'} granted`)
      if (gift.umaShards > 0) useGame.getState().pushToast(`+${gift.umaShards} Uma Shard${gift.umaShards === 1 ? '' : 's'} granted`)
      if (settled && settled.tickets > 0) {
        useGame.getState().pushToast(`+${settled.tickets} Training Level-Up Ticket${settled.tickets === 1 ? '' : 's'} from EXP past TL10`)
      }
      if (archivedAwards > 0) useGame.getState().pushToast(`Flair archive updated · ${archivedAwards} awards`)
      if (trainerArchive.events.length > 0) useGame.getState().pushToast(`Trainer archive updated · ${trainerArchive.events.length} achievements`)
      window.addEventListener('online', this.onlineHandler)
      document.addEventListener('visibilitychange', this.visibilityHandler)
      await this.refreshPending()
      this.schedule(0)
    } catch (error) {
      if (generation !== this.generation) return
      setGameLifecycle('error', error instanceof Error ? error.message : String(error))
    }
  }

  stop(clear = true): void {
    this.generation += 1
    this.uninstallMinigameHost?.()
    this.uninstallMinigameHost = null
    this.uninstallMinigameJournal?.()
    this.uninstallMinigameJournal = null
    this.uninstallFarmHost?.()
    this.uninstallFarmHost = null
    this.content = null
    this.memoryRaceHistory = []
    this.memoryCardRedemptions.clear()
    this.memoryUmaRedemptions.clear()
    this.badgePreferenceLocks.clear()
    this.unitLocks.clear()
    this.memoryExchangeSequence = 0
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onlineHandler)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler)
    if (clear) clearGameState()
  }

  schedule(delay = 750): void {
    const state = useGame.getState()
    if (!state.persistent || state.sync.pending === 0 || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delay)
  }

  async setFeaturedUma(id: string): Promise<void> {
    const state = useGame.getState()
    if (state.status !== 'ready' || !state.profile || !state.umas[id]) throw new Error('Featured Uma must be owned')
    const profile = { ...state.profile, featuredUmaId: id }
    if (!state.persistent) {
      replaceProfile(profile)
      return
    }
    const now = Date.now()
    await db.transaction('rw', db.profile, db.outbox, async () => {
      const row = await db.profile.get('main')
      if (!row) throw new Error('Local profile is missing')
      await db.profile.put({ ...row, data: profile })
      await queueInTransaction('profile', 'main', 'upsert', now)
    })
    replaceProfile(profile)
    await this.refreshPending()
    this.schedule()
  }

  /** One outfit's synced race defaults; no current journey, level, result, or reward is rewritten. */
  async setRacePreferences(id: string, preferences: RacePreferences): Promise<void> {
    const generation = this.generation
    const state = useGame.getState()
    const uma = state.umas[id]
    if (state.status !== 'ready' || !uma) throw new Error('Race preferences Uma must be owned')
    const next = { ...uma, racePreferences: preferences }
    if (!parseUmaSave(next)) throw new Error('Race preferences are invalid')
    if (!state.persistent) {
      replaceUma(next)
      return
    }
    const now = Date.now()
    const committed = await db.transaction('rw', [db.umas, db.outbox], async () => {
      const row = await db.umas.get(id)
      if (!row) throw new Error('Local Uma is missing')
      const current = parseUmaSave(row.data)
      if (!current) throw new Error('Local Uma is malformed')
      const updated = parseUmaSave({ ...current, racePreferences: preferences })
      if (!updated) throw new Error('Race preferences are invalid')
      await db.umas.put({ ...row, data: updated })
      await queueInTransaction('umas', id, 'upsert', now)
      return updated
    })
    if (generation !== this.generation) return
    replaceUma(committed)
    await this.refreshPending()
    this.schedule()
  }

  /** Selects the distance preset her profile shows and edits (D252); no build, level or result is touched. */
  async setActivePreset(id: string, preset: DistanceCategory): Promise<void> {
    const generation = this.generation
    const state = useGame.getState()
    const uma = state.umas[id]
    if (state.status !== 'ready' || !uma) throw new Error('Preset Uma must be owned')
    if (uma.activePreset === preset) return
    const next = parseUmaSave({ ...uma, activePreset: preset })
    if (!next) throw new Error('That preset is invalid')
    if (!state.persistent) {
      replaceUma(next)
      return
    }
    const now = Date.now()
    const committed = await db.transaction('rw', [db.umas, db.outbox], async () => {
      const row = await db.umas.get(id)
      if (!row) throw new Error('Local Uma is missing')
      const current = parseUmaSave(row.data)
      if (!current) throw new Error('Local Uma is malformed')
      const updated = parseUmaSave({ ...current, activePreset: preset })
      if (!updated) throw new Error('That preset is invalid')
      await db.umas.put({ ...row, data: updated })
      await queueInTransaction('umas', id, 'upsert', now)
      return updated
    })
    if (generation !== this.generation) return
    replaceUma(committed)
    await this.refreshPending()
    this.schedule()
  }

  async saveBadgePreferences(id: string, preferences: BadgePreferences | TrainerBadgePreferences, now = Date.now()) {
    if (this.badgePreferenceLocks.has(id)) throw new Error('Badge preferences are already being saved')
    this.badgePreferenceLocks.add(id)
    try {
      const generation = this.generation
      const state = useGame.getState()
      const current = state.badges[id]
      if (state.status !== 'ready' || !current) throw new Error('Badge state is not ready')
      const mutation = state.persistent
        ? await persistBadgePreferences(id, preferences, now)
        : replaceMemoryBadgePreferences(
            current,
            preferences,
            current.scope === 'trainer' ? trainerAllowedAwardRefs(Object.values(state.badges)) : undefined,
            current.scope === 'trainer' ? new Set(Object.keys(state.umas)) : undefined,
          )
      if (generation !== this.generation) return mutation
      if (mutation.changed) replaceBadgeState({ ...state.badges, [id]: mutation.state } as Record<string, typeof mutation.state>)
      if (state.persistent && mutation.changed) {
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.badgePreferenceLocks.delete(id)
    }
  }

  async listFlairTimeline(
    umaId: string,
    before: FlairTimelineCursor | null = null,
    kind: FlairEventKind | null = null,
    limit = 30,
  ) {
    const state = useGame.getState()
    if (state.status !== 'ready' || !state.umas[umaId]) throw new Error('Timeline Uma must be owned')
    return state.persistent
      ? readFlairTimelinePage(umaId, before, kind, limit)
      : pageMemoryFlairTimeline(state.flairEvents, umaId, before, kind, limit)
  }

  private reconcileMemoryTrainer(now: number, sourceId: string): string[] {
    const content = this.content
    const state = useGame.getState()
    const trainer = state.badges.trainer
    if (!content || state.status !== 'ready' || state.persistent || !trainer || trainer.scope !== 'trainer') return []
    const ledger: { id: string; data: LedgerEntry }[] = [
      ...[...this.memoryCardRedemptions].sort().map((id) => ({
        id: `card-coupon-redeem:${id}`,
        data: { resource: 'card-coupons' as const, delta: -1, reason: 'card-coupon-redeem' as const, localDay: null, createdAt: now },
      })),
      ...[...this.memoryUmaRedemptions].sort().map((id) => ({
        id: `uma-coupon-redeem:${id}`,
        data: { resource: 'uma-coupons' as const, delta: -1, reason: 'uma-coupon-redeem' as const, localDay: null, createdAt: now },
      })),
    ]
    const result = reconcileTrainerMemory({
      content,
      state: trainer,
      umas: Object.values(state.umas),
      cards: Object.values(state.cards),
      badges: Object.values(state.badges),
      ledger,
      raceResults: this.memoryRaceHistory,
      now,
      retroactive: false,
      sourceId,
    })
    if (result.changed || result.events.length > 0) mergeBadgeAndFlairState({ ...state.badges, trainer: result.state }, result.events)
    return result.events.map((event) => event.id)
  }

  /** Assigns or clears a Card or Lineage node. Extra stats are bought and turned on beside the tree (D235). */
  async setConstellationNode(id: string, nodeId: string, assignment: NodeAssignment | null, tier?: number): Promise<void> {
    const generation = this.generation
    const state = useGame.getState()
    const uma = state.umas[id]
    if (state.status !== 'ready' || !uma) throw new Error('Constellation Uma must be owned')

    // Any of her trained units reconfigures the same way (D190).
    const run = trainedScenario(uma, tier)
    const node = constellationTemplate(run.tier).nodes.find((entry) => entry.id === nodeId)
    if (!node || node.kind === 'root') throw new Error('Unknown constellation node')
    if (!isNodeUnlocked(constellationTemplate(run.tier), node, run.trainingLevel, run.inspiration)) {
      throw new Error('That node is still locked')
    }
    const capIssue = cardNodeCapIssue(run, nodeId, assignment)
    if (capIssue) throw new Error(capIssue)
    if (assignment?.kind === 'lineage') {
      const content = this.content, child = content?.umas.byId.get(id), candidate = content?.umas.byId.get(assignment.templateId)
      if (!content || !child || !candidate || (!state.umas[candidate.id] && !(run.tier === 10 && nodeId === 'parent0'))) throw new Error('Lineage Uma unavailable or not owned')
      const held = new Map(Object.entries(run.assignments).flatMap(([slot, a]) => {
        const entry = a.kind === 'lineage' ? content.umas.byId.get(a.templateId) : null
        return entry ? [[slot, entry] as const] : []
      }))
      const issue = lineageSlotEligibility(candidate, child, nodeId, held)
      if (!issue.eligible) throw new Error(issue.reason!)
    }

    const assignments = { ...run.assignments }
    if (assignment) assignments[nodeId] = assignment
    else delete assignments[nodeId]
    // Node assignments belong to the preset being edited (D252).
    const next: UmaSave = withScenarioView(uma, { ...run, assignments })

    if (!state.persistent) {
      replaceUma(next)
      return
    }
    const now = Date.now()
    const content = this.content
    await db.transaction('rw', [db.umas, db.badges, db.ledger, db.flairEvents, db.outbox], async () => {
      const row = await db.umas.get(id)
      if (!row) throw new Error('Local Uma is missing')
      if (JSON.stringify(row.data) !== JSON.stringify(uma)) throw new Error('Uma changed; reopen this slot before editing')
      await db.umas.put({ ...row, data: next })
      await queueInTransaction('umas', id, 'upsert', now)
      // Filling the last node of a tree is her Full House (T056).
      if (content) await updateTrainingBadgeFacts({ content, uma: next, sourceId: `constellation:${id}:${run.tier}`, now })
    })
    if (generation !== this.generation) return
    replaceUma(next)
    await this.refreshBadges()
    await this.refreshPending()
    this.schedule()
  }

  /** Buys a unit's next Extra stat node of one stat with that scenario's crop (D235). Needs local storage. */
  async unlockExtraStat(input: { umaId: string; tier: number; nodeId: ExtraStatNodeId }): Promise<UnlockExtraStatReceipt> {
    const key = `${input.umaId}:${input.tier}`
    if (this.unitLocks.has(key)) throw new Error('That Extra stats grid is already being updated')
    this.unitLocks.add(key)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      if (!content || state.status !== 'ready' || !state.umas[input.umaId]) throw new Error('Training Uma must be owned')
      if (!state.persistent) throw new Error('Buying Extra stats needs local storage')
      try {
        const receipt = await unlockPersistentExtraStat(content, { ...input, now: Date.now() })
        if (generation !== this.generation) return receipt
        replaceUma(receipt.uma)
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
        return receipt
      } catch (error) {
        // A stale screen must show the grid as it is before the player chooses again.
        if (error instanceof ExtraStatConflictError && generation === this.generation) {
          const row = await db.umas.get(input.umaId)
          const latest = row ? parseUmaSave(row.data) : null
          if (latest) replaceUma(latest)
        }
        throw error
      }
    } finally {
      this.unitLocks.delete(key)
    }
  }

  /** Spends Training Level-Up Tickets on one unit, one Training Level each (D213). Needs local storage. */
  async spendLevelUpTickets(input: Omit<SpendLevelUpTicketsInput, 'now'>): Promise<LevelUpTicketsReceipt> {
    const key = `${input.umaId}:${input.tier}`
    if (this.unitLocks.has(`level-up:${key}`)) throw new Error('Those tickets are already being used')
    this.unitLocks.add(`level-up:${key}`)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      if (!content || state.status !== 'ready' || !state.umas[input.umaId]) throw new Error('Training Uma must be owned')
      if (!state.persistent) throw new Error('Level-Up Tickets need local storage')
      try {
        const receipt = await spendPersistentLevelUpTickets(content, { ...input, now: Date.now() })
        if (generation !== this.generation) return receipt
        replaceUma(receipt.uma)
        replaceProfile(receipt.profile)
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
        return receipt
      } catch (error) {
        // A stale screen shows the unit as it is before the player chooses again.
        if (error instanceof LevelUpTicketsStaleError && generation === this.generation) {
          const row = await db.umas.get(input.umaId)
          const latest = row ? parseUmaSave(row.data) : null
          if (latest) replaceUma(latest)
        }
        throw error
      }
    } finally {
      this.unitLocks.delete(`level-up:${key}`)
    }
  }

  /** Turns a bought Extra stat node on or off: free and reversible, six on at most (D235). */
  async setExtraStatActive(id: string, tier: number, nodeId: ExtraStatNodeId, on: boolean): Promise<void> {
    const generation = this.generation
    const state = useGame.getState()
    const uma = state.umas[id]
    if (state.status !== 'ready' || !uma) throw new Error('Training Uma must be owned')
    const run = trainedScenario(uma, tier)
    const extraStats = toggleExtraStat(run.extraStats, nodeId, on)
    // Which bought nodes are on belongs to the preset being edited (D252).
    const next: UmaSave = withScenarioView(uma, { ...run, extraStats })
    if (!state.persistent) {
      replaceUma(next)
      return
    }
    const now = Date.now()
    const content = this.content
    await db.transaction('rw', [db.umas, db.badges, db.ledger, db.flairEvents, db.outbox], async () => {
      const row = await db.umas.get(id)
      if (!row) throw new Error('Local Uma is missing')
      await db.umas.put({ ...row, data: next })
      await queueInTransaction('umas', id, 'upsert', now)
      if (content) await updateTrainingBadgeFacts({ content, uma: next, sourceId: `extra-stats:${id}:${run.tier}`, now })
    })
    if (generation !== this.generation) return
    replaceUma(next)
    await this.refreshBadges()
    await this.refreshPending()
    this.schedule()
  }

  async setUmaLoadout(id: string, skillIds: readonly string[], tier?: number): Promise<void> {
    const generation = this.generation
    const content = this.content
    const state = useGame.getState()
    const uma = state.umas[id]
    const template = content?.umas.byId.get(id)
    if (!content || state.status !== 'ready' || !uma || !template) throw new Error('Loadout Uma must be owned')
    const derived = deriveUma({
      uma,
      tier,
      umaTemplate: template,
      cardSaves: new Map(Object.entries(state.cards)),
      cardTemplates: content.cards.byId,
      umaTemplates: content.umas.byId,
      skillTemplates: content.skills.byId,
    })
    const loadoutSkillIds = resolveSkillLoadout(derived, template, content.skills.byId, skillIds)
    // The loadout belongs to the preset being edited (D252).
    const next: UmaSave = withScenarioView(uma, { ...trainedScenario(uma, derived.tier), loadoutSkillIds })
    if (!state.persistent) {
      replaceUma(next)
      return
    }
    const now = Date.now()
    await db.transaction('rw', db.umas, db.outbox, async () => {
      const row = await db.umas.get(id)
      if (!row) throw new Error('Local Uma is missing')
      await db.umas.put({ ...row, data: next })
      await queueInTransaction('umas', id, 'upsert', now)
    })
    if (generation !== this.generation) return
    replaceUma(next)
    await this.refreshPending()
    this.schedule()
  }

  async setUmaDeck(id: string, orderedCardIds: readonly string[], now = Date.now(), tier?: number): Promise<void> {
    if (this.deckLocks.has(id)) throw new Error('This deck is already being saved')
    this.deckLocks.add(id)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[id]
      if (!content || state.status !== 'ready' || !uma) throw new Error('Deck Uma must be owned')
      const mutation = state.persistent
        ? await setPersistentUmaDeck(content, id, orderedCardIds, now, tier)
        : setMemoryUmaDeck(content, uma, state.cards, orderedCardIds, tier)
      if (generation !== this.generation) return
      replaceUma(mutation.uma)
      if (state.persistent && mutation.changed) {
        await this.refreshPending()
        this.schedule()
      }
    } finally {
      this.deckLocks.delete(id)
    }
  }

  async prepareRace(umaId: string, raceId: string, strategy: Strategy, sequence?: number, tier?: number) {
    const content = this.content
    const state = useGame.getState()
    const uma = state.umas[umaId]
    if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Race Uma must be owned')
    return state.persistent
      ? preparePersistentRace(content, umaId, raceId, strategy, sequence, tier)
      : prepareMemoryRace(content, state.profile, uma, state.cards, this.memoryRaceHistory, raceId, strategy, sequence, tier)
  }

  async completeRace(attempt: PreparedRace, today = localDay(), now = Date.now()) {
    if (this.raceLocks.has(attempt.umaId)) throw new Error('A race is already resolving for this Uma')
    this.raceLocks.add(attempt.umaId)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[attempt.umaId]
      if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Race Uma must be owned')
      const completion = state.persistent
        ? await completePersistentRace(content, attempt, today, now)
        : completeMemoryRace(content, state.profile, uma, state.cards, this.memoryRaceHistory, attempt, today, now)
      if (generation !== this.generation) return completion
      replaceRaceState(completion.profile, completion.uma)
      if (!state.persistent && !completion.alreadyRecorded) {
        const id = badgeStateId(uma.templateId)
        const prior = state.badges[id]
        if (!prior || prior.scope !== 'uma') throw new Error('Memory badge state is missing')
        if (!completion.record.accomplishmentFacts) throw new Error('Memory race accomplishment facts are missing')
        const raceFlair = updateMemoryRaceBadgeFacts({
          content,
          state: prior,
          umaBefore: uma,
          umaAfter: completion.uma,
          resultId: attempt.id,
          record: completion.record,
          facts: completion.record.accomplishmentFacts,
          now,
        })
        let badges = { ...state.badges, [id]: raceFlair.state }
        const events = [...raceFlair.events]
        const finalJourneyState = (save: UmaSave) =>
          save.scenarios.find((run) => run.tier === SCENARIOS.length)?.journey?.state ?? null
        const completedFinalTier = finalJourneyState(completion.uma) === 'completed' &&
          finalJourneyState(uma) !== 'completed'
        if (completedFinalTier) {
          const scenarioFlair = updateMemoryScenarioBadgeFacts({
            content,
            before: completion.uma,
            after: completion.uma,
            completedTier: SCENARIOS.length,
            badges,
            umas: { ...state.umas, [completion.uma.templateId]: completion.uma },
            now,
          })
          badges = scenarioFlair.states
          events.push(...scenarioFlair.events)
        }
        completion.record = { ...completion.record, earnedFlairEventIds: events.map((event) => event.id) }
        this.memoryRaceHistory.push(completion.record)
        mergeBadgeAndFlairState(badges, events)
        const trainerIds = this.reconcileMemoryTrainer(now, attempt.id)
        if (trainerIds.length > 0) {
          completion.record = { ...completion.record, earnedFlairEventIds: [...(completion.record.earnedFlairEventIds ?? []), ...trainerIds] }
          this.memoryRaceHistory[this.memoryRaceHistory.length - 1] = completion.record
        }
      }
      if (state.persistent) {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return completion
    } finally {
      this.raceLocks.delete(attempt.umaId)
    }
  }

  async startScenario(id: string, now = Date.now()) {
    if (this.promotionLocks.has(id)) throw new Error('This Uma is already starting a scenario')
    this.promotionLocks.add(id)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[id]
      if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Scenario Uma must be owned')
      const mutation = state.persistent
        ? await startPersistentScenario(content, id, now)
        : startMemoryScenario(content, state.profile, uma, state.cards)
      if (generation !== this.generation) return mutation
      replaceUmaCollectionState(mutation.profile, mutation.uma)
      if (!state.persistent && !mutation.alreadyStarted) {
        const flair = updateMemoryScenarioBadgeFacts({
          content,
          before: uma,
          after: mutation.uma,
          completedTier: mutation.result?.fromTier ?? null,
          badges: state.badges,
          umas: { ...state.umas, [mutation.uma.templateId]: mutation.uma },
          now,
        })
        mutation.badgeStates = flair.states
        mutation.earnedFlairEventIds = flair.events.map((event) => event.id)
        mergeBadgeAndFlairState(flair.states, flair.events)
        mutation.earnedFlairEventIds.push(...this.reconcileMemoryTrainer(now, `scenario:${id}:${now}`))
      }
      if (state.persistent && !mutation.alreadyStarted) {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.promotionLocks.delete(id)
    }
  }

  /** Unlocks the next scenario: spends tickets and opens a fresh run at Training Level 1. */
  async advanceUma(id: string, now = Date.now()) {
    if (this.promotionLocks.has(id)) throw new Error('This Uma is already advancing')
    this.promotionLocks.add(id)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[id]
      if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Scenario Uma must be owned')
      const mutation = state.persistent
        ? await advancePersistentUma(content, id, now)
        : advanceMemoryUma(content, state.profile, uma, state.cards, now)
      if (generation !== this.generation) return mutation
      replaceUmaCollectionState(mutation.profile, mutation.uma)
      if (!state.persistent) {
        const flair = updateMemoryScenarioBadgeFacts({
          content,
          before: uma,
          after: mutation.uma,
          completedTier: mutation.result?.fromTier ?? null,
          badges: state.badges,
          umas: { ...state.umas, [mutation.uma.templateId]: mutation.uma },
          now,
        })
        mutation.badgeStates = flair.states
        mutation.earnedFlairEventIds = flair.events.map((event) => event.id)
        mergeBadgeAndFlairState(flair.states, flair.events)
        mutation.earnedFlairEventIds.push(...this.reconcileMemoryTrainer(now, `scenario:${id}:${now}`))
      } else {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.promotionLocks.delete(id)
    }
  }

  async listLatestRaceTimes(): Promise<Record<string, number>> {
    if (!useGame.getState().persistent) {
      const latest: Record<string, number> = {}
      for (const record of this.memoryRaceHistory) latest[record.umaId] = Math.max(latest[record.umaId] ?? 0, record.createdAt)
      return latest
    }
    return readLatestRaceTimes()
  }

  async listUmaRaceHistory(umaId: string): Promise<RaceResultRecord[]> {
    return useGame.getState().persistent
      ? readUmaRaceHistory(umaId)
      : this.memoryRaceHistory.filter((record) => record.umaId === umaId).sort((left, right) => left.createdAt - right.createdAt)
  }

  async listRaceHistory(limit = 20): Promise<RaceResultRecord[]> {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid race history limit')
    return useGame.getState().persistent
      ? readRaceHistory(limit)
      : [...this.memoryRaceHistory].sort((left, right) => right.createdAt - left.createdAt).slice(0, limit)
  }

  /** Owner-only playtest top-up (docs/design/economy.md). Never reachable from ordinary play. */
  async grantDevResources(grant: DevGrant, today = localDay(), now = Date.now()) {
    const generation = this.generation
    const state = useGame.getState()
    if (state.status !== 'ready' || !state.profile) throw new Error('Save is not ready')
    if (!state.persistent) {
      const next = {
        ...state.profile,
        tickets: state.profile.tickets + grant.tickets,
        cardCoupons: state.profile.cardCoupons + grant.cardCoupons,
        umaCoupons: state.profile.umaCoupons + grant.umaCoupons,
        umaShards: state.profile.umaShards + grant.umaShards,
      }
      replaceProfile(next)
      return { profile: next, ledgerIds: [] }
    }
    const mutation = await grantPersistentDevResources(grant, today, now)
    if (generation !== this.generation) return mutation
    replaceProfile(mutation.profile)
    await this.refreshPending()
    this.schedule()
    return mutation
  }

  async exchangeUmaShards(today = localDay(), now = Date.now()) {
    if (this.exchangeLocked) throw new Error('Uma Shards are already being exchanged')
    this.exchangeLocked = true
    try {
      const generation = this.generation
      const state = useGame.getState()
      if (state.status !== 'ready' || !state.profile) throw new Error('Collection save is not ready')
      const mutation = state.persistent
        ? await exchangePersistentUmaShards(today, now)
        : exchangeMemoryUmaShards(state.profile, this.memoryExchangeSequence + 1, today, now)
      if (generation !== this.generation) return mutation
      if (!state.persistent) this.memoryExchangeSequence = mutation.sequence
      replaceProfile(mutation.profile)
      if (state.persistent) {
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.exchangeLocked = false
    }
  }

  /** Owns a card with a Card Select Coupon (D198). A retry after a committed unlock returns the same result. */
  async unlockCard(
    cardId: string,
    today = localDay(),
    now = Date.now(),
  ): Promise<CardRedemptionMutation> {
    if (this.cardRedemptionLocks.has(cardId)) throw new Error('This card is already being unlocked')
    this.cardRedemptionLocks.add(cardId)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      if (!content || state.status !== 'ready' || !state.profile) throw new Error('Collection save is not ready')
      let mutation: CardRedemptionMutation
      if (!state.persistent && this.memoryCardRedemptions.has(cardId) && state.cards[cardId]) {
        mutation = {
          profile: state.profile,
          card: state.cards[cardId],
          ledgerId: `card-coupon-redeem:${cardId}`,
          alreadyRedeemed: true,
        }
      } else {
        mutation = state.persistent
          ? await redeemPersistentCard(content, cardId, today, now)
          : redeemMemoryCard(content, state.profile, state.cards, cardId, today, now)
      }
      if (generation !== this.generation) return mutation
      // Coupon rows feed the memory trainer's Coupon Clipper count.
      if (!state.persistent) this.memoryCardRedemptions.add(cardId)
      replaceCardState(mutation.profile, mutation.card)
      if (!state.persistent && !mutation.alreadyRedeemed) this.reconcileMemoryTrainer(now, mutation.ledgerId)
      if (state.persistent) {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.cardRedemptionLocks.delete(cardId)
    }
  }

  async redeemUmaCoupon(umaId: string, today = localDay(), now = Date.now()): Promise<UmaRedemptionMutation> {
    if (this.umaRedemptionLocks.has(umaId)) throw new Error('This Uma Coupon is already being redeemed')
    this.umaRedemptionLocks.add(umaId)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      if (!content || state.status !== 'ready' || !state.profile) throw new Error('Collection save is not ready')
      let mutation: UmaRedemptionMutation
      if (!state.persistent && this.memoryUmaRedemptions.has(umaId) && state.umas[umaId]) {
        const badgeState = state.badges[badgeStateId(umaId)]
        if (!badgeState || badgeState.scope !== 'uma' || badgeState.umaId !== umaId) throw new Error('Memory badge state is missing')
        mutation = {
          profile: state.profile,
          uma: state.umas[umaId],
          ledgerId: `uma-coupon-redeem:${umaId}`,
          alreadyRedeemed: true,
          badgeState,
          flairEvents: [],
        }
      } else {
        mutation = state.persistent
          ? await redeemPersistentUma(content, umaId, today, now)
          : redeemMemoryUma(content, state.profile, state.umas, umaId, today, now)
      }
      if (generation !== this.generation) return mutation
      if (!state.persistent) this.memoryUmaRedemptions.add(umaId)
      replaceUmaCollectionState(mutation.profile, mutation.uma)
      if (!state.persistent) mergeBadgeAndFlairState({ ...state.badges, [badgeStateId(umaId)]: mutation.badgeState }, mutation.flairEvents)
      if (!state.persistent && !mutation.alreadyRedeemed) this.reconcileMemoryTrainer(now, mutation.ledgerId)
      if (state.persistent) {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.umaRedemptionLocks.delete(umaId)
    }
  }

  private async refreshPending(): Promise<void> {
    const [ordinary, rpg, conflicts] = await Promise.all([db.outbox.count(), db.pendingRpgCommands.count(),
      db.pendingRpgCommands.where('status').equals('conflict').count()])
    const pending = ordinary + rpg
    const online = typeof navigator === 'undefined' || navigator.onLine
    setSyncState({ status: !online && pending ? 'offline' : conflicts ? 'error' : pending ? 'pending' : 'idle', pending,
      error: conflicts ? 'RPG command conflicted; progress was not applied' : null })
  }

  private async refreshBadges(): Promise<void> {
    const snapshot = await readLocalSnapshot()
    if (!snapshot) return
    replaceBadgeState(
      Object.fromEntries(snapshot.badges.map((row) => [row.id, row.data])),
      snapshot.flairEvents.map((row) => ({ id: row.id, ...row.data })),
    )
  }

  /** Publish explicitly refreshed accepted rows without discarding ordinary queued edits in Dexie. */
  async refreshLocalState(): Promise<void> {
    const generation = this.generation
    const snapshot = await readLocalSnapshot()
    if (snapshot && this.content && generation === this.generation) adoptGameState(stateFromSnapshot(snapshot, this.content, true))
    await this.refreshPending()
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.content || !useGame.getState().persistent) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = await Promise.all([db.outbox.count(), db.pendingRpgCommands.count()])
        .then(([ordinary, rpg]) => ordinary + rpg).catch(() => useGame.getState().sync.pending)
      setSyncState({ status: pending > 0 ? 'offline' : 'idle', pending })
      return
    }
    this.flushing = true
    const generation = this.generation
    try {
      const batch = await db.outbox.orderBy('seq').limit(MAX_SYNC_OPERATIONS).toArray()
      if (batch.length === 0) {
        const accepted = await flushOneRpgCommand()
        if (accepted) {
          const local = await readLocalSnapshot()
          if (local && this.content) adoptGameState(stateFromSnapshot(local, this.content, true))
        }
        const [ordinary, rpg, actionable] = await Promise.all([db.outbox.count(), db.pendingRpgCommands.count(),
          db.pendingRpgCommands.where('status').equals('pending').count()])
        setSyncState({ status: rpg > actionable ? 'error' : ordinary + rpg ? 'pending' : 'idle',
          pending: ordinary + rpg, error: rpg > actionable ? 'RPG command conflicted; progress was not applied' : null })
        if (actionable > 0) this.schedule(0)
        return
      }
      setSyncState({ status: 'syncing', error: null })
      const request: SyncRequest = { upserts: [], appends: [] }
      for (const item of batch) {
        if (
          !Number.isSafeInteger(item.seq) ||
          !Number.isSafeInteger(item.queuedAt) ||
          item.queuedAt < 0 ||
          (item.op === 'upsert' && !['profile', 'umas', 'cards', 'badges', 'farm', 'items'].includes(item.kind)) ||
          (item.op === 'append' && !['raceResults', 'ledger', 'flairEvents', 'itemLedger'].includes(item.kind))
        ) {
          throw new Error('Outbox row is malformed')
        }
        if (item.op === 'upsert') {
          const row = await entityRow(item.kind as EntityKind, item.id)
          if (!row) throw new Error(`Outbox entity is missing: ${item.kind}/${item.id}`)
          request.upserts.push({ kind: item.kind as EntityKind, id: item.id, baseVersion: row.version, data: toRecord(row.data) })
        } else {
          const row = await logRow(item.kind as LogKind, item.id)
          if (!row) throw new Error(`Outbox log is missing: ${item.kind}/${item.id}`)
          request.appends.push({ kind: item.kind as LogKind, id: item.id, data: toRecord(row.data), createdAt: row.createdAt })
        }
      }
      const rawResponse = await saveApi.sync(request)
      // Judged on the server's copy as sent: the response parser migrates conflicts to the current schema.
      const legacyConflicts = legacyConflictKeys(rawResponse)
      const response = parseSyncResponseOrThrow(rawResponse)
      if (generation !== this.generation) return
      const acknowledged = acknowledgedSequences(batch, request, response)
      const sentSequence = new Map(batch.map((item) => [`${item.kind}/${item.id}`, item.seq]))

      await db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.farm, db.items, db.itemLedger, db.outbox], async () => {
        for (const applied of response.applied) await updateEntityVersion(applied.kind, applied.id, applied.version)
        for (const conflict of response.conflicts) {
          const current = await db.outbox.where('[kind+id]').equals([conflict.kind, conflict.id]).first()
          const originalSequence = sentSequence.get(`${conflict.kind}/${conflict.id}`)
          const legacy = legacyConflicts.has(`${conflict.kind}/${conflict.id}`)
          if (current?.seq !== originalSequence && conflict.kind !== 'badges') {
            await updateEntityVersion(conflict.kind, conflict.id, conflict.version)
          } else if (legacy && await entityRow(conflict.kind, conflict.id)) {
            // The server's copy predates the save schema this app writes, so ours is newer: keep it, take the server's
            // version, and send it again. Adopting the old copy would roll the save back to before the migration (D156).
            await updateEntityVersion(conflict.kind, conflict.id, conflict.version)
            await queueInTransaction(conflict.kind, conflict.id, 'upsert', response.serverTime)
          } else {
            // Badge conflicts always adopt the server's newer award facts and reapply only still-valid local preferences.
            await putConflict(conflict, legacy, response.serverTime)
          }
        }
        await db.outbox.bulkDelete(acknowledged)
        await reconcileFarmProjectionsInTransaction(response.serverTime)
      })
      await flushOneRpgCommand()
      if (generation !== this.generation) return
      const local = await readLocalSnapshot()
      if (local && this.content) adoptGameState(stateFromSnapshot(local, this.content, true))
      const [ordinary, rpg, actionable] = await Promise.all([db.outbox.count(), db.pendingRpgCommands.count(),
        db.pendingRpgCommands.where('status').equals('pending').count()])
      const pending = ordinary + rpg
      const syncedAt = Date.now()
      rememberLastSync(syncedAt)
      setSyncState({ status: rpg > actionable ? 'error' : pending ? 'pending' : 'idle', pending,
        lastSuccessAt: syncedAt, error: rpg > actionable ? 'RPG command conflicted; progress was not applied' : null })
      if (ordinary + actionable > 0) this.schedule(0)
    } catch (error) {
      const pending = await Promise.all([db.outbox.count(), db.pendingRpgCommands.count()])
        .then(([ordinary, rpg]) => ordinary + rpg).catch(() => useGame.getState().sync.pending)
      setSyncState({ status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error', pending, error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.flushing = false
    }
  }
}

export const gameRuntime = new GameRuntime()
