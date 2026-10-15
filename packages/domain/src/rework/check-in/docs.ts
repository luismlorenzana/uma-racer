// The operations' live block (docs/game/architecture.md#the-rework-modules "The live manual"): rework/13 §6's list of
// every change to the account, rendered from `OPERATIONS`, so a new operation can't land without its line. Registered in
// packages/domain/src/docs/rework.ts. Pure: no I/O.
import { OPERATIONS, type OperationName } from './once'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => ` ${String(c).replace(/\|/g, '\\|')} `).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}

/** What each operation does, in a line, and the page whose rules it runs. */
export const OPERATION_DOCS: Readonly<Record<OperationName, readonly [what: string, page: string]>> = Object.freeze({
  start: ['Starts a job or session in a slot, or restarts a stopped queue', '07 §2, 05 §2, 02 §4'],
  queue: ['Adds, removes or moves a queued request, or dismisses a stopped queue', '07 §2, 02 §3–§4'],
  collect: ["Pays one Uma's finished items or unlocks", '07 §2, 05 §2'],
  'collect-all': ["Collects every finished slot, or one place's", '02 §2'],
  repeat: ["Restarts each Free Uma's last job or session", '02 §5'],
  recall: ['Stops her running entry and returns the unmade inputs', '07 §2'],
  'speed-up': ['Speed Tickets on one running entry, or Speed up all', '07 §8, 02 §4'],
  finish: ['Ends her running entry with the Speed Tickets it takes', '07 §8'],
  upgrade: ['Raises a building one level for its Prize Money and crafted items', '07 §7, 05 §7'],
  'advance-scenario': ['Moves an Uma at her gate, career won, to the next scenario', '03 §5'],
  promote: ['Promotes an Uma to the next tier', '04 §3–§5'],
  induct: ['Enters a tier-3 Uma into the Hall of Fame', '04 §10'],
  buy: ['Buys Speed Tickets or raw ingredients at the Exchange', '09 §5'],
  sell: ['Sells surplus items for Prize Money', '09 §6'],
  'unlock-uma': ['Unlocks an Uma with an Uma Ticket', '04 §6'],
  'exchange-shards': ['Turns five Uma Shards into an Uma Ticket', '04 §6'],
  'set-targets': ["The planner's targets, up to five in order", '02 §6'],
  'set-check-in-times': ['The check-in times, one to four', '02 §3'],
  'set-repeat-sizing': ["Repeat's same size or fit to the next check-in", '02 §5'],
  'set-card-set': ["A preset's card set", '06 §3'],
  'set-assignments': ["A preset's node assignments", '05 §4'],
  'set-lineage': ["A preset's lineage picks", '05 §5'],
  'set-active-nodes': ["A preset's active Extra Stats nodes", '05 §6'],
  'set-loadout': ["A preset's equipped skills", '03 §6'],
  'finish-race': ["A race's commit: her finished unlocks, Racing EXP, goals, the gate's Shard, Prize Money and the purse", '09 §9, 01 §2'],
  'dev-grant': ['Dev builds and a dev API only: items, Prize Money, Uma Tickets, finished work, a jump to her gate', 'M034'],
})

/** 13 §6: every operation, in `OPERATIONS` order. */
function operations(): string {
  return table(['Operation', 'What it does', 'Rules'],
    (Object.keys(OPERATIONS) as OperationName[]).map((name) => [`\`${name}\``, OPERATION_DOCS[name][0], OPERATION_DOCS[name][1]]))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  operations,
})
