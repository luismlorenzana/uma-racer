import { describe, expect, it } from 'vitest'
import { scenarioCoverageWarning } from './scenario-coverage'

const seconds = (date: string): number => Date.parse(`${date}T03:00:00Z`) / 1_000

describe('scenario coverage warning', () => {
  it('warns with aggregate counts and dates when released source rows exceed the modeled ladder', () => {
    const source = [
      { start_ja: seconds('2000-01-01'), ignored_name: 'Synthetic One' },
      { start_ja: seconds('2000-06-01'), ignored_id: 2 },
      { start_ja: seconds('2001-01-01'), ignored_name: 'Future Synthetic' },
    ]
    expect(scenarioCoverageWarning(source, ['2000-01-01'], new Date('2000-12-31T12:00:00Z'))).toBe(
      'Scenario ladder is behind: source has 2 JP releases through 2000-06-01; modeled 1 through 2000-01-01',
    )
  })

  it('stays quiet when coverage is current and rejects malformed source dates', () => {
    const source = [{ start_ja: seconds('2000-01-01') }, { start_ja: seconds('2001-01-01') }]
    expect(scenarioCoverageWarning(source, ['2000-01-01'], new Date('2000-12-31T12:00:00Z'))).toBeNull()
    expect(() => scenarioCoverageWarning([{ start_ja: 'not-a-timestamp' }], [], new Date('2000-01-01T00:00:00Z')))
      .toThrow(/invalid JP start date/)
  })
})
