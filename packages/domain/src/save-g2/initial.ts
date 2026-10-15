// The new account as rows (docs/rework/13-removals-and-plan-changes.md §5; docs/rearchitecture/07-data-reset.md §5; T134).
// Its values are `newWorkState(newAccount(now))`'s, restated nowhere here: 20 Uma Tickets under `initial-uma-tickets`,
// no Umas, no work, an empty Warehouse and every building at Lv 1, with the purse, the Exchange's grade, automatic
// targets, the default check-ins and Repeat's size as the rules start them. The create carries only `createdAt`; the
// server builds these rows itself, so the device never uploads a balance.
import { BUILDING_IDS } from '../rework/farm/buildings'
import { newAccount } from '../rework/tiers/roster'
import { newWorkState } from '../rework/work/state'
import { entityDraft, logDraft, type EntityDraft, type LogDraft } from './rows'
import type { SaveState } from './state'

export interface InitialSave {
  readonly state: SaveState
  /** `profile/main` and the 14 `buildings` rows. */
  readonly entities: readonly EntityDraft[]
  /** The ledger row `initial-uma-tickets`. */
  readonly logs: readonly LogDraft[]
}

/** The rows of a new account created at `now`. */
export function initialSave(now: number): InitialSave {
  const state = newWorkState(newAccount(now))
  return {
    state,
    entities: [
      entityDraft('profile', 'main', state.profile),
      ...BUILDING_IDS.map((id) => entityDraft('buildings', id, state.buildings[id])),
    ],
    logs: state.ledger.map((row) => logDraft('ledger', row.id, row.at, row)),
  }
}
