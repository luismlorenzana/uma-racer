// Local-first save bootstrap and background sync (docs/tasks/T003-stable-save-foundation.md).

import {
  MAX_SYNC_OPERATIONS,
  assertProgressionRaceContent,
  assertTrainingContent,
  assertSaveContent,
  createInitialSave,
  parseSyncResponseOrThrow,
  type EntityKind,
  type Facility,
  type LogKind,
  type TrainingTurnResult,
  type SyncRequest,
  type RaceResultRecord,
  type Strategy,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { saveApi } from '../api/client'
import { db } from './db'
import {
  adoptServerSnapshot,
  applyOwedDailyGrant,
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
import { adoptGameState, clearGameState, localDay, replaceProfile, replaceRaceState, replaceTrainingState, replaceUma, setGameLifecycle, setSyncState, useGame } from './store'
import { acknowledgedSequences } from './sync'
import { ensureMemoryTrainingDeck, ensurePersistentTrainingDeck, persistTraining, resolveMemoryTraining } from './training'
import {
  completeMemoryRace,
  completePersistentRace,
  prepareMemoryRace,
  preparePersistentRace,
  readRaceHistory,
  type PreparedRace,
} from './racing'

const toRecord = (value: object): Record<string, unknown> => value as unknown as Record<string, unknown>

export class GameRuntime {
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private content: LoadedContent | null = null
  private flushing = false
  private trainingLocks = new Set<string>()
  private raceLocks = new Set<string>()
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
      assertTrainingContent(content.umas.items, content.cards.items, content.skills.items)
      assertProgressionRaceContent(content.races.items)
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
        adoptGameState({
          profile: initial.profile,
          umas: Object.fromEntries(initial.umas.map((item) => [item.templateId, item])),
          cards: Object.fromEntries(initial.cards.map((item) => [item.templateId, item])),
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
      const granted = await applyOwedDailyGrant(today, now)
      local = await readLocalSnapshot()
      if (!local) throw new Error('Save initialization did not produce a profile')
      if (generation !== this.generation) return
      adoptGameState(stateFromSnapshot(local, content, true))
      if (granted > 0) useGame.getState().pushToast(`+${granted} 🎫 Daily tickets`)
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
    this.content = null
    this.memoryRaceHistory = []
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

  async ensureTrainingDeck(id: string): Promise<void> {
    const generation = this.generation
    const content = this.content
    const state = useGame.getState()
    const uma = state.umas[id]
    if (!content || state.status !== 'ready' || !uma) throw new Error('Training Uma must be owned')
    const next = state.persistent
      ? await ensurePersistentTrainingDeck(content, id, Date.now())
      : ensureMemoryTrainingDeck(content, uma, state.cards)
    if (generation !== this.generation) return
    replaceUma(next)
    if (state.persistent) {
      await this.refreshPending()
      this.schedule()
    }
  }

  async trainUma(id: string, facility: Facility, today = localDay(), now = Date.now()): Promise<TrainingTurnResult> {
    if (this.trainingLocks.has(id)) throw new Error('Training is already resolving for this Uma')
    this.trainingLocks.add(id)
    try {
      const generation = this.generation
      const content = this.content
      const state = useGame.getState()
      const uma = state.umas[id]
      if (!content || state.status !== 'ready' || !state.profile || !uma) throw new Error('Training Uma must be owned')
      const mutation = state.persistent
        ? await persistTraining(content, id, facility, today, now)
        : resolveMemoryTraining({
          content,
          profile: state.profile,
          uma,
          cardsById: state.cards,
          facility,
          today,
          now,
        })
      if (generation !== this.generation) return mutation.result
      replaceTrainingState(mutation.profile, mutation.uma, mutation.cards)
      if (state.persistent) {
        await this.refreshPending()
        this.schedule()
      }
      return mutation.result
    } finally {
      this.trainingLocks.delete(id)
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
      if (!state.persistent && !completion.alreadyRecorded) this.memoryRaceHistory.push(completion.record)
      replaceRaceState(completion.profile, completion.uma)
      if (state.persistent) {
        await this.refreshPending()
        this.schedule()
      }
      return completion
    } finally {
      this.raceLocks.delete(attempt.umaId)
    }
  }

  async listRaceHistory(limit = 20): Promise<RaceResultRecord[]> {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid race history limit')
    return useGame.getState().persistent
      ? readRaceHistory(limit)
      : [...this.memoryRaceHistory].sort((left, right) => right.createdAt - left.createdAt).slice(0, limit)
  }

  private async refreshPending(): Promise<void> {
    const pending = await db.outbox.count()
    const online = typeof navigator === 'undefined' || navigator.onLine
    setSyncState({ status: pending === 0 ? 'idle' : online ? 'pending' : 'offline', pending, error: null })
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
          (item.op === 'append' && !['raceResults', 'ledger'].includes(item.kind))
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
      const response = parseSyncResponseOrThrow(await saveApi.sync(request))
      if (generation !== this.generation) return
      const acknowledged = acknowledgedSequences(batch, request, response)
      const sentSequence = new Map(batch.map((item) => [`${item.kind}/${item.id}`, item.seq]))

      await db.transaction('rw', db.profile, db.umas, db.cards, db.badges, db.outbox, async () => {
        for (const applied of response.applied) await updateEntityVersion(applied.kind, applied.id, applied.version)
        for (const conflict of response.conflicts) {
          const current = await db.outbox.where('[kind+id]').equals([conflict.kind, conflict.id]).first()
          const originalSequence = sentSequence.get(`${conflict.kind}/${conflict.id}`)
          if (current?.seq !== originalSequence) await updateEntityVersion(conflict.kind, conflict.id, conflict.version)
          else await putConflict(conflict)
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
