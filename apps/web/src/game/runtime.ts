// Local-first save bootstrap and background sync (docs/technical/architecture.md).

import {
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
  activeScenario,
  constellationTemplate,
  isNodeUnlocked,
  type NodeAssignment,
  type UmaSave,
  parseSyncResponseOrThrow,
  SCENARIOS,
  replaceSkillLoadout as resolveSkillLoadout,
  type EntityKind,
  type LogKind,
  type SyncRequest,
  type RaceResultRecord,
  type Strategy,
  type BadgePreferences,
  type TrainerBadgePreferences,
  type FlairEventKind,
  type LedgerEntry,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { saveApi } from '../api/client'
import { db } from './db'
import {
  adoptServerSnapshot,
  applyOwedDailyGrant,
  bootstrapGoalPlans,
  completeStarterSeed,
  entityRow,
  isDatabaseSemanticallyEmpty,
  logRow,
  persistInitial,
  putConflict,
  queueInTransaction,
  readLocalSnapshot,
  stateFromSnapshot,
  updateEntityVersion,
} from './persistence'
import { adoptGameState, clearGameState, localDay, mergeBadgeAndFlairState, replaceBadgeState, replaceProfile, replaceRaceState, replaceTrainingState, replaceUma, setGameLifecycle, setSyncState, useGame } from './store'
import { replaceCardState } from './store'
import { acknowledgedSequences } from './sync'
import {
  completeMemoryRace,
  completePersistentRace,
  prepareMemoryRace,
  preparePersistentRace,
  readLatestRaceTimes,
  readRaceHistory,
  type PreparedRace,
} from './racing'
import { promoteMemoryCard, promotePersistentCard } from './cards'
import { setMemoryUmaDeck, setPersistentUmaDeck } from './decks'
import {
  type DevGrant,
  grantPersistentDevResources,
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
import { PersistentMinigameHost } from './minigame-runs'

const toRecord = (value: object): Record<string, unknown> => value as unknown as Record<string, unknown>

function legacyConflictKeys(value: unknown): Set<string> {
  const keys = new Set<string>()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return keys
  const conflicts = (value as Record<string, unknown>).conflicts
  if (!Array.isArray(conflicts)) return keys
  for (const conflict of conflicts) {
    if (typeof conflict !== 'object' || conflict === null || Array.isArray(conflict)) continue
    const record = conflict as Record<string, unknown>
    if ((record.kind !== 'profile' && record.kind !== 'umas') || typeof record.id !== 'string' || typeof record.data !== 'object' || record.data === null) continue
    const data = record.data as Record<string, unknown>
    if (record.kind === 'profile' ? data.schemaVersion === 1 : !Object.hasOwn(data, 'schemaVersion')) {
      keys.add(`${record.kind}/${record.id}`)
    }
  }
  return keys
}

export class GameRuntime {
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private content: LoadedContent | null = null
  private uninstallMinigameHost: (() => void) | null = null
  private flushing = false
  private trainingLocks = new Set<string>()
  private raceLocks = new Set<string>()
  private promotionLocks = new Set<string>()
  private cardLocks = new Set<string>()
  private deckLocks = new Set<string>()
  private cardRedemptionLocks = new Set<string>()
  private umaRedemptionLocks = new Set<string>()
  private badgePreferenceLocks = new Set<string>()
  private exchangeLocked = false
  private memoryCardRedemptions = new Set<string>()
  private memoryUmaRedemptions = new Set<string>()
  private memoryExchangeSequence = 0
  private memoryRaceHistory: RaceResultRecord[] = []
  private onlineHandler = () => void this.flush()
  private visibilityHandler = () => {
    if (document.visibilityState === 'hidden') void this.flush()
  }

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
      const trainerArchive = await reconcileTrainerPersistent(content, now, true, 'migration:trainer')
      local = await readLocalSnapshot()
      if (!local) throw new Error('Save initialization did not produce a profile')
      if (generation !== this.generation) return
      adoptGameState(stateFromSnapshot(local, content, true))
      if (granted > 0) useGame.getState().pushToast(`+${granted} 🎫 Daily tickets`)
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
    this.content = null
    this.memoryRaceHistory = []
    this.memoryCardRedemptions.clear()
    this.memoryUmaRedemptions.clear()
    this.badgePreferenceLocks.clear()
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

  /**
   * Assigns or clears one constellation node. Free, instant and always reversible: reconfiguring is the
   * point of the system, so it costs nothing and cannot fail on a locked or unknown node (D121).
   */
  async setConstellationNode(id: string, nodeId: string, assignment: NodeAssignment | null): Promise<void> {
    const generation = this.generation
    const state = useGame.getState()
    const uma = state.umas[id]
    if (state.status !== 'ready' || !uma) throw new Error('Constellation Uma must be owned')

    const run = activeScenario(uma)
    const node = constellationTemplate(run.tier).nodes.find((entry) => entry.id === nodeId)
    if (!node || node.kind === 'root') throw new Error('Unknown constellation node')
    if (!isNodeUnlocked(constellationTemplate(run.tier), node, run.trainingLevel)) {
      throw new Error('That node is still locked')
    }

    const assignments = { ...run.assignments }
    if (assignment) assignments[nodeId] = assignment
    else delete assignments[nodeId]
    const next: UmaSave = {
      ...uma,
      scenarios: uma.scenarios.map((entry) => (entry.tier === run.tier ? { ...entry, assignments } : entry)),
    }

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

  async setUmaLoadout(id: string, skillIds: readonly string[]): Promise<void> {
    const generation = this.generation
    const content = this.content
    const state = useGame.getState()
    const uma = state.umas[id]
    const template = content?.umas.byId.get(id)
    if (!content || state.status !== 'ready' || !uma || !template) throw new Error('Loadout Uma must be owned')
    const derived = deriveUma({
      uma,
      umaTemplate: template,
      cardSaves: new Map(Object.entries(state.cards)),
      cardTemplates: content.cards.byId,
      umaTemplates: content.umas.byId,
    })
    const loadoutSkillIds = resolveSkillLoadout(derived, template, content.skills.byId, skillIds)
    const next: UmaSave = {
      ...uma,
      scenarios: uma.scenarios.map((run) =>
        run.tier === uma.unlockedTier ? { ...run, loadoutSkillIds } : run),
    }
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

  async setUmaDeck(id: string, orderedCardIds: readonly string[], now = Date.now()): Promise<void> {
    if (this.deckLocks.has(id)) throw new Error('This deck is already being saved')
    this.deckLocks.add(id)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[id]
      if (!content || state.status !== 'ready' || !uma) throw new Error('Deck Uma must be owned')
      const mutation = state.persistent
        ? await setPersistentUmaDeck(content, id, orderedCardIds, now)
        : setMemoryUmaDeck(content, uma, state.cards, orderedCardIds)
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

  async prepareRace(umaId: string, raceId: string, strategy: Strategy, sequence?: number) {
    const content = this.content
    const state = useGame.getState()
    const uma = state.umas[umaId]
    if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Race Uma must be owned')
    return state.persistent
      ? preparePersistentRace(content, umaId, raceId, strategy, sequence)
      : prepareMemoryRace(content, state.profile, uma, state.cards, this.memoryRaceHistory, raceId, strategy, sequence)
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

  async listRaceHistory(limit = 20): Promise<RaceResultRecord[]> {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid race history limit')
    return useGame.getState().persistent
      ? readRaceHistory(limit)
      : [...this.memoryRaceHistory].sort((left, right) => right.createdAt - left.createdAt).slice(0, limit)
  }

  async promoteCard(cardId: string, tier: number, today = localDay(), now = Date.now()) {
    if (this.cardLocks.has(cardId)) throw new Error('This card is already being promoted')
    this.cardLocks.add(cardId)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const card = state.cards[cardId]
      if (!content || state.status !== 'ready' || !state.profile || !card) throw new Error('Support card must be owned')
      const mutation = state.persistent
        ? await promotePersistentCard(content, cardId, tier, today, now)
        : promoteMemoryCard(content, state.profile, card, tier, today, now)
      if (generation !== this.generation) return mutation
      replaceCardState(mutation.profile, mutation.card)
      if (!state.persistent) this.reconcileMemoryTrainer(now, `card-limit-break:${cardId}:${mutation.result.tier}:${mutation.result.toLimitBreak}`)
      if (state.persistent) {
        await this.refreshBadges()
        await this.refreshPending()
        this.schedule()
      }
      return mutation
    } finally {
      this.cardLocks.delete(cardId)
    }
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

  async redeemCardCoupon(cardId: string, today = localDay(), now = Date.now()): Promise<CardRedemptionMutation> {
    if (this.cardRedemptionLocks.has(cardId)) throw new Error('This Card Coupon is already being redeemed')
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
    const pending = await db.outbox.count()
    const online = typeof navigator === 'undefined' || navigator.onLine
    setSyncState({ status: pending === 0 ? 'idle' : online ? 'pending' : 'offline', pending, error: null })
  }

  private async refreshBadges(): Promise<void> {
    const snapshot = await readLocalSnapshot()
    if (!snapshot) return
    replaceBadgeState(
      Object.fromEntries(snapshot.badges.map((row) => [row.id, row.data])),
      snapshot.flairEvents.map((row) => ({ id: row.id, ...row.data })),
    )
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.content || !useGame.getState().persistent) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const pending = await db.outbox.count().catch(() => useGame.getState().sync.pending)
      setSyncState({ status: pending > 0 ? 'offline' : 'idle', pending })
      return
    }
    this.flushing = true
    const generation = this.generation
    try {
      const batch = await db.outbox.orderBy('seq').limit(MAX_SYNC_OPERATIONS).toArray()
      if (batch.length === 0) {
        setSyncState({ status: 'idle', pending: 0, error: null })
        return
      }
      setSyncState({ status: 'syncing', error: null })
      const request: SyncRequest = { upserts: [], appends: [] }
      for (const item of batch) {
        if (
          !Number.isSafeInteger(item.seq) ||
          !Number.isSafeInteger(item.queuedAt) ||
          item.queuedAt < 0 ||
          (item.op === 'upsert' && !['profile', 'umas', 'cards', 'badges'].includes(item.kind)) ||
          (item.op === 'append' && !['raceResults', 'ledger', 'flairEvents'].includes(item.kind))
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
      const migratedConflicts = legacyConflictKeys(rawResponse)
      const response = parseSyncResponseOrThrow(rawResponse)
      if (generation !== this.generation) return
      const acknowledged = acknowledgedSequences(batch, request, response)
      const sentSequence = new Map(batch.map((item) => [`${item.kind}/${item.id}`, item.seq]))

      await db.transaction('rw', db.profile, db.umas, db.cards, db.badges, db.outbox, async () => {
        for (const applied of response.applied) await updateEntityVersion(applied.kind, applied.id, applied.version)
        for (const conflict of response.conflicts) {
          const current = await db.outbox.where('[kind+id]').equals([conflict.kind, conflict.id]).first()
          const originalSequence = sentSequence.get(`${conflict.kind}/${conflict.id}`)
          if (current?.seq !== originalSequence && conflict.kind !== 'badges') {
            await updateEntityVersion(conflict.kind, conflict.id, conflict.version)
          } else {
            // Badge conflicts always adopt the server's newer award facts and reapply only still-valid local preferences.
            await putConflict(conflict, migratedConflicts.has(`${conflict.kind}/${conflict.id}`), response.serverTime)
          }
        }
        await db.outbox.bulkDelete(acknowledged)
      })
      if (generation !== this.generation) return
      const local = await readLocalSnapshot()
      if (local && this.content) adoptGameState(stateFromSnapshot(local, this.content, true))
      const pending = await db.outbox.count()
      setSyncState({ status: pending ? 'pending' : 'idle', pending, lastSuccessAt: Date.now(), error: null })
      if (pending) this.schedule(0)
    } catch (error) {
      const pending = await db.outbox.count().catch(() => useGame.getState().sync.pending)
      setSyncState({ status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error', pending, error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.flushing = false
    }
  }
}

export const gameRuntime = new GameRuntime()
