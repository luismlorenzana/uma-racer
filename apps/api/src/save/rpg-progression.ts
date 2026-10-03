// Independent bounded RPG transition validation; never runs combat (docs/technical/uma-rpg-implementation.md).
import { isDeepStrictEqual } from 'node:util'
import { rpgRecord } from './rpg-save.types'

export function progression(level: number, exp: number, delta: number): { level: number; exp: number } | null {
  if (!Number.isSafeInteger(exp + delta)) return null
  exp += delta
  while (level < 50 && exp >= 120 + 16 * level) { exp -= 120 + 16 * level; level++ }
  return { level, exp }
}
export function frozenReward(kitJson: string, member: Record<string, unknown>, win: boolean): number | null {
  if (!win) return 0
  try {
    const kit: unknown = JSON.parse(kitJson)
    if (!rpgRecord(kit) || kit.format !== 'rpg-combat-kit-v2') return 0 // Unrewarded v1 entries.
    const r = kit.reward
    if (!rpgRecord(r) || !Number.isSafeInteger(r.baseExp) || (r.baseExp as number) < 0 || (r.baseExp as number) > 1_000_000 ||
      !Number.isSafeInteger(r.recommendedTier) || (r.recommendedTier as number) < 1 || (r.recommendedTier as number) > 10_000 ||
      !Number.isSafeInteger(r.recommendedLevel) || (r.recommendedLevel as number) < 1 || (r.recommendedLevel as number) > 50) return null
    const diff = 50 * ((member.tier as number) - (r.recommendedTier as number)) + (member.level as number) - (r.recommendedLevel as number)
    return r.baseExp === 0 ? 0 : Math.max(1, Math.round((r.baseExp as number) * Math.max(0.25, Math.min(1.5, 1 - 0.025 * diff))))
  } catch { return null }
}
export function skillKey(ref: Record<string, unknown>): string {
  return `${ref.tier}:${ref.weapon}:${ref.element}:${ref.depth}:${ref.branch}`
}
export function legalLoadout(profile: Record<string, unknown>, slot: Record<string, unknown>): boolean {
  if (!rpgRecord(profile.affinities) || !profile.affinities[slot.signature as string] || !Array.isArray(slot.loadout) ||
    !Array.isArray(profile.tree) || !Array.isArray(profile.legacy)) return false
  const slots = 2 + [1, 10, 20, 35, 50].filter((gate) => (profile.level as number) >= gate).length
  if (slot.loadout.length > slots) return false
  let carried = 0
  return slot.loadout.every((ref: Record<string, unknown>) => {
    if ((ref.tier as number) < (profile.tier as number)) carried++
    const source = ref.tier === profile.tier ? profile.tree : profile.legacy
    return ref.weapon === profile.weapon && carried <= 2 && (source as Record<string, unknown>[])
      .some((s) => skillKey(s) === skillKey(ref))
  })
}
export function oneTreePoint(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const a = before.tree as Record<string, unknown>[], b = after.tree as Record<string, unknown>[]
  const ignore = (p: Record<string, unknown>) => { const copy = { ...p }; delete copy.tree; return copy }
  if (!isDeepStrictEqual(ignore(before), ignore(after)) || b.length < a.length || b.length > a.length + 1) return false
  let increased = 0
  for (const skill of a) {
    const next = b.find((s) => skillKey(s) === skillKey(skill))
    if (!next || !isDeepStrictEqual({ ...next, level: skill.level }, skill) ||
      (next.level !== skill.level && next.level !== (skill.level as number) + 1)) return false
    if (next.level !== skill.level) increased++
  }
  for (const skill of b) if (!a.some((s) => skillKey(s) === skillKey(skill))) {
    if (skill.level !== 1) return false
    increased++
  }
  return increased === 1 // Full parser also checks points, predecessor, affinity, level and skill-level gates.
}
