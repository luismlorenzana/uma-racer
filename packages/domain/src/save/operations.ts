// Every operation, by name (D381): the areas' definitions joined into one table that `commitOperation` dispatches
// through. A name defined twice fails at load. Each M036 part replaces its stubs in its own area's `ops.ts`.
import { ACCOUNT_OPERATIONS } from '../account/ops'
import { BUILD_OPERATIONS } from '../build/ops'
import { CAREER_OPERATIONS } from '../career/ops'
import { STAGE_OPERATIONS } from '../stages/ops'
import type { AnyOperationDef } from './registry'

function table(...groups: readonly (readonly AnyOperationDef[])[]): ReadonlyMap<string, AnyOperationDef> {
  const byName = new Map<string, AnyOperationDef>()
  for (const def of groups.flat()) {
    if (byName.has(def.name)) throw new Error(`Operation "${def.name}" is defined twice`)
    byName.set(def.name, def)
  }
  return byName
}

export const OPERATIONS = table(ACCOUNT_OPERATIONS, CAREER_OPERATIONS, BUILD_OPERATIONS, STAGE_OPERATIONS)

/** Every operation's name, in the table's order. */
export const OPERATION_NAMES: readonly string[] = Object.freeze([...OPERATIONS.keys()])

export const isOperationName = (value: unknown): value is string => typeof value === 'string' && OPERATIONS.has(value)
