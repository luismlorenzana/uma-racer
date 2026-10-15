import { fullSpurtStamina, type Stats } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { raceStatFit } from './race-fit'

const even = (value: number): Stats => ({ speed: value, stamina: value, power: value, guts: value, wit: value })

describe('race stat fit', () => {
  it('reads Stamina against what a full spurt needs at this distance and style', () => {
    const stats = { ...even(800), stamina: 0 }
    const need = Math.round(fullSpurtStamina(2000, 'front', 800, 800))
    const at = (stamina: number, distance = 2000) => raceStatFit({ stats: { ...stats, stamina }, rivals: [], distance, strategy: 'front' })
      .find((fit) => fit.stat === 'stamina')!
    expect(at(Math.round(need * 1.1))).toMatchObject({ verdict: 'good', reference: need })
    expect(at(need)).toMatchObject({ verdict: 'average' })
    expect(at(Math.round(need * 0.8))).toMatchObject({ verdict: 'bad' })
    // Past the need, Stamina buys nothing at 2,000 m: the spare is named. Above 2,100 m the stamina contest uses it.
    expect(at(need + 350).spare).toBe(350)
    expect(at(3000, 3200).spare).toBe(0)
    // The same Uma needs far more at 3,200 m than at 1,200 m.
    expect(at(600, 3200).reference).toBeGreaterThan(at(600, 1200).reference * 3)
  })

  it('ranks the other stats against the field she will meet', () => {
    const rivals = [even(500), even(600), even(700), even(800), even(900), even(1000)]
    const fit = (power: number) => raceStatFit({ stats: { ...even(750), power }, rivals, distance: 1600, strategy: 'pace' })
      .find((entry) => entry.stat === 'power')!
    expect(fit(1100)).toMatchObject({ verdict: 'good', ahead: 6, rivals: 6, reference: 750 })
    expect(fit(750)).toMatchObject({ verdict: 'average', ahead: 3 })
    expect(fit(550)).toMatchObject({ verdict: 'bad', ahead: 1 })
    // Ties count half, and above 1,200 a point counts half, as in a race.
    expect(fit(800).ahead).toBe(3.5)
    expect(raceStatFit({ stats: { ...even(750), speed: 1300 }, rivals: [{ ...even(700), speed: 1250 }], distance: 1600, strategy: 'pace' })
      .find((entry) => entry.stat === 'speed')!.ahead).toBe(1)
  })
})
