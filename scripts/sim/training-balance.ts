// Friendship Training balance (M020 T063–T064):
//
//   pnpm sim:training                        clear rates by star, and each scenario twist at 3★
//   pnpm sim:training -- --runs=400          more seeds per row
//   pnpm sim:training -- --content=<dir>     read the pack from another folder (default content/data)
//
// Setups are built from the local, gitignored content pack the way a real run is: a main card, a six-card set around
// it and a large owned pool, each with plausible stars. The domain minigame bot plays each
// seed; the table prints only rates. Exit 1 when a row leaves its band.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FT_TWISTS,
  buildFriendshipSetup,
  ftBotPlay,
  ftRng,
  ftShuffle,
  type RaceTemplate,
  type SkillTemplate,
  type SupportCardTemplate,
} from '../../packages/domain/src/index'

const args = process.argv.slice(2)
const CONTENT = args.find((value) => value.startsWith('--content='))?.split('=')[1] ?? 'content/data'
const RUNS = Number(args.find((value) => value.startsWith('--runs='))?.split('=')[1] ?? 240)

function pack<T>(prefix: string): T[] {
  const file = readdirSync(CONTENT).find((name) => name.startsWith(`${prefix}.`) && name.endsWith('.json'))
  if (!file) throw new Error(`No ${prefix} pack in ${CONTENT}; run pnpm data:import or pass --content=<dir>`)
  return (JSON.parse(readFileSync(join(CONTENT, file), 'utf8')) as { items: T[] }).items
}

const cards = pack<SupportCardTemplate>('cards')
const skills = pack<SkillTemplate>('skills')
const races = pack<RaceTemplate>('races')

/** A plausible player at this star: a set built around the main card, an owned pool, stars by how far along they are. */
function setupFor(tier: number, earning: number, seed: number) {
  const random = ftRng(seed, 'sim')
  const eligible = cards.filter((card) => card.era <= tier)
  const stat = eligible.filter((card) => card.type !== 'friend' && card.type !== 'group')
  const main = stat[Math.floor(random() * stat.length)]!
  const pool = ftShuffle(eligible.filter((card) => card.id !== main.id), random)
  const sameType = pool.filter((card) => card.type === main.type).slice(0, 2)
  const broad = random() < 0.5 ? pool.filter((card) => card.type === 'friend' || card.type === 'group').slice(0, 1) : []
  const rest = pool.filter((card) => !sameType.includes(card) && !broad.includes(card))
  const set = [...sameType, ...broad, ...rest].slice(0, 5)
  const owned = [main, ...set, ...rest.slice(5, 80)]
  const starsFor = () => Math.min(4, Math.floor(random() * (earning + 1)))
  return buildFriendshipSetup({
    seed,
    tier,
    mainStars: earning - 1,
    mainCard: main,
    setCardIds: set.map((card) => card.id),
    owned: owned.map((template) => ({ template, stars: template.id === main.id ? earning - 1 : starsFor() })),
    skills,
    races,
  })
}

function clearRate(tier: number, earning: number): number {
  let cleared = 0
  for (let run = 0; run < RUNS; run += 1) {
    const { state } = ftBotPlay(setupFor(tier, earning, 1000 * tier + 97 * earning + run * 7919))
    if (state.phase === 'won') cleared += 1
  }
  return (100 * cleared) / RUNS
}

const TARGETS: Readonly<Record<number, number>> = { 1: 90, 2: 85, 3: 80, 4: 75, 5: 70 }
const BAND = 8
let failures = 0
const started = Date.now()

console.log(`Friendship Training clear rates, bot, ${RUNS} seeds per row (target ±${BAND})`)
console.log('Foundation (URA Finale)')
for (let earning = 1; earning <= 5; earning += 1) {
  const rate = clearRate(1, earning)
  const ok = Math.abs(rate - TARGETS[earning]!) <= BAND
  if (!ok) failures += 1
  console.log(`  ${earning}★  ${rate.toFixed(0).padStart(3)}%  target ${TARGETS[earning]}%${ok ? '' : '  ✗'}`)
}

// A twist is an edge, never a wall: at 3★ each scenario clears no less than the base game's band allows, and no more
// than a few points above it.
console.log('Twists at 3★')
for (let tier = 2; tier <= FT_TWISTS.length; tier += 1) {
  const rate = clearRate(tier, 3)
  const ok = rate >= TARGETS[3]! - BAND && rate <= TARGETS[3]! + 12
  if (!ok) failures += 1
  console.log(`  ${FT_TWISTS[tier - 1]!.name.padEnd(13)} ${rate.toFixed(0).padStart(3)}%${ok ? '' : '  ✗'}`)
}
console.log(`${((Date.now() - started) / 1000).toFixed(1)} s`)
process.exit(failures > 0 ? 1 : 0)
