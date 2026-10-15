// Account's view model and the Town Hall's copy (02 §3, §9; D157; M034): check-in times as clock times, the sync row's
// words, the dev grants, the reveal's queue and save words, and every player-facing string in the Town Hall's places
// held to 02 §9's banned words.
import { BANNED_WORDS, hasBannedWord } from '@racer/domain/check-in'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readRevealQueue, revealPath } from '../reveal/path'
import { SAVE_WORDS } from '../reveal/words'
import { checkInTimes, clockOf, DEV_GRANTS, minuteOf, SYNC_WORDS } from './model'

describe('check-in times (02 §3)', () => {
  it('reads and writes clock times as minutes after local midnight, ascending', () => {
    expect([clockOf(480), clockOf(1_350), clockOf(0)]).toEqual(['08:00', '22:30', '00:00'])
    expect([minuteOf('08:00'), minuteOf('7:05'), minuteOf('24:00'), minuteOf('12:60'), minuteOf('noon')]).toEqual([480, 425, null, null, null])
    expect(checkInTimes(['22:30', '08:00', '13:00'])).toEqual([480, 780, 1_350])
    expect(checkInTimes(['08:00', ''])).toBeNull()
  })
})

describe('the dev grants (M034)', () => {
  it('are dev-grant inputs: Prize Money, Uma Tickets and every grade-1 raw, crafted and dish', () => {
    expect(DEV_GRANTS.map((grant) => grant.key)).toEqual(['prize-money', 'uma-tickets', 'grade-1'])
    expect(Object.keys(DEV_GRANTS[2]!.input.items!)).toHaveLength(24)
  })
})

describe('the reveal queue (11 §6)', () => {
  it('carries the Umas still to show and how many there were, so Next reads "2 of 5" after a reload', () => {
    expect(revealPath(['a'])).toBe('/collection/reveal/uma/a')
    expect(revealPath(['a', 'b', 'c'])).toBe('/collection/reveal/uma/a?then=b%2Cc&of=3')
    expect(readRevealQueue('?then=b%2Cc&of=3')).toEqual({ then: ['b', 'c'], at: 1, of: 3 })
    expect(readRevealQueue('?then=c&of=3')).toEqual({ then: ['c'], at: 2, of: 3 })
    expect(readRevealQueue('')).toEqual({ then: [], at: 1, of: 1 })
    expect(revealPath([])).toBe('/town/stable?tab=owned')
  })
})

const PLACES = fileURLToPath(new URL('..', import.meta.url))
const TOWN = ['stable', 'warehouse', 'exchange', 'card-library', 'account', 'reveal']

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : []
  })
}

/** JSX text and the prose in string literals: anything with a space and a letter that a screen could show. */
function strings(source: string): string[] {
  const text = [...source.matchAll(/>([^<>{}=();!&|]*[A-Za-z][^<>{}=();!&|]*)</g)].map((match) => match[1]!.trim())
  const literals = [...source.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*?[A-Za-z]+ [A-Za-z][^'`\n]*?)\1/g)].map((match) => match[2]!)
  return [...text, ...literals].filter((entry) => entry.length > 0 && !entry.startsWith('/') && !/^[\w-]+(\s[\w-]+)*=/.test(entry))
}

describe('the Town Hall says nothing banned (02 §9)', () => {
  it('in its words tables', () => {
    for (const text of [...Object.values(SAVE_WORDS), ...Object.values(SYNC_WORDS), ...DEV_GRANTS.map((grant) => grant.label)]) {
      expect(hasBannedWord(text), text).toBe(false)
    }
  })

  it('in any screen string of its places', () => {
    const offenders: string[] = []
    const seen: string[] = []
    for (const place of TOWN) {
      for (const file of sources(join(PLACES, place))) {
        for (const text of strings(readFileSync(file, 'utf8'))) {
          seen.push(text)
          // Class lists and code read as prose to the scan; only words a screen shows count.
          if (/^(?:[\w:[\]/.%()-]+\s)*[\w:[\]/.%()-]+$/.test(text) && /(?:^|\s)(?:flex|min-|text-|px-|rounded|bg-|grid|gap-)/.test(text)) continue
          const words = text.replace(/\$\{[^}]*(\}|$)/g, ' ')
          if (BANNED_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`, 'i').test(words)) || /\bsync (error|failed)\b/i.test(words)) offenders.push(`${place}: ${text}`)
        }
      }
    }
    // The scan reads the screens' words: a button's label and a sheet's sentence among them.
    expect(seen).toContain('Feature another Uma')
    expect(seen).toContain('Nothing is waiting to sync.')
    expect(offenders).toEqual([])
  })
})
