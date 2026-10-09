// Lightweight inventory identity validation, without the named food catalogue (implementation §§2–3).
import { SCENARIOS } from '../../scenarios'
import { STATS } from '../../types'
import { FARM_PROCESSES, FARM_RAW_FAMILIES, FARM_KITCHEN_ENERGY_ID } from './rules'
export function isFarmKitchenItemId(value: unknown): value is string {
  if (value === FARM_KITCHEN_ENERGY_ID) return true
  if (typeof value !== 'string') return false
  const p = value.split(':')
  if (p[0] !== 'farm') return false
  if (p[1] === 'meal') {
    if (p.length !== 4 || !/^b[1-9]\d*$/.test(p[2]!) || Number(p[2]!.slice(1)) > Math.ceil(SCENARIOS.length / 5)) return false
    if (p[3] === 'sun' || STATS.includes(p[3] as typeof STATS[number])) return true
    const pair = p[3]!.split('-'), a = STATS.indexOf(pair[0] as typeof STATS[number]), b = STATS.indexOf(pair[1] as typeof STATS[number])
    return pair.length === 2 && a >= 0 && b > a
  }
  return p.length === 5 && SCENARIOS.some(s => s.id === p[2]) && STATS.includes(p[4] as typeof STATS[number]) &&
    (p[1] === 'raw' ? FARM_RAW_FAMILIES.includes(p[3] as typeof FARM_RAW_FAMILIES[number])
      : p[1] === 'processed' && FARM_PROCESSES.some(r => r.id === p[3]))
}
