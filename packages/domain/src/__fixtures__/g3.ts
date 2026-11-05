// Shared test fixtures for generation 3 (D381): a fixed clock, operation ids, a frozen-state helper and a small
// synthetic content env. Invented values only: no real Uma, card or race data.
import type { RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import type { OperationEnv } from '../save/registry'

/** Milliseconds at `HH:MM` on a fixed day (2026-11-04 UTC). */
export const clock = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return Date.UTC(2026, 10, 4, h ?? 0, m ?? 0)
}

/** An operation id: 8+ characters, unique per n. */
export const opId = (n: number): string => `op-test-${String(n).padStart(4, '0')}`

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export const uma = (n: number): string => `uma-${n}`
export const card = (n: number): string => `card-${n}`

const umaTemplate = (n: number): UmaTemplate => ({ id: uma(n), name: `Test Uma ${n}` }) as unknown as UmaTemplate
const cardTemplate = (n: number): SupportCardTemplate => ({ id: card(n), title: `Test Card ${n}` }) as unknown as SupportCardTemplate

function env(dev: boolean): OperationEnv {
  return {
    content: {
      umas: new Map([1, 2, 3].map((n) => [uma(n), umaTemplate(n)])),
      cards: new Map([1, 2, 3].map((n) => [card(n), cardTemplate(n)])),
      skills: new Map<string, SkillTemplate>(),
      races: [] as RaceTemplate[],
      courses: new Map(),
    },
    contentVersion: 'test-content',
    ...(dev ? { dev: true } : {}),
  }
}

/** The env production runs: no dev operations. */
export const ENV = env(false)
/** The env a dev build runs: `dev-grant` allowed. */
export const DEV = env(true)
