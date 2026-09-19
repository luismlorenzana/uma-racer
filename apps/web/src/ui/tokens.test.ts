import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The Paddock system is a contract (docs/design/visual-system.md): a renamed or dropped token must fail
// loudly here rather than silently rendering an unstyled screen.
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

const TOKENS = [
  '--font-display', '--font-ui',
  '--color-page', '--color-panel', '--color-sunken', '--color-stage', '--color-stage-soft',
  '--color-ink', '--color-ink-soft', '--color-ink-faint', '--color-ink-on-dark', '--color-ink-on-dark-soft',
  '--color-accent', '--color-accent-strong', '--color-accent-wash', '--color-turf', '--color-dirt',
  '--color-stat-speed', '--color-stat-stamina', '--color-stat-power', '--color-stat-guts', '--color-stat-wit',
  '--color-tier-bronze', '--color-tier-silver', '--color-tier-gold', '--color-tier-platinum',
  '--color-success', '--color-danger', '--color-warning', '--color-info',
  '--color-hairline', '--color-hairline-strong', '--color-hairline-dark',
  '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--chamfer',
  '--shadow-1', '--shadow-2', '--shadow-3',
  '--duration-fast', '--duration-standard', '--duration-emphasised', '--ease-standard',
]

const UTILITIES = ['.text-micro', '.numeral', '.numeral-on-dark', '.chamfer-tr', '.art-scrim', '.font-display']

describe('paddock tokens', () => {
  it('defines every documented token', () => {
    const missing = TOKENS.filter((token) => !css.includes(`${token}:`))
    expect(missing).toEqual([])
  })

  it('defines the utilities components rely on', () => {
    const missing = UTILITIES.filter((utility) => !css.includes(`${utility} {`))
    expect(missing).toEqual([])
  })

  it('loads both faces from latin-only variable subsets', () => {
    expect(css).toContain('outfit-latin-wght-normal.woff2')
    expect(css).toContain('inter-latin-wght-normal.woff2')
    expect(css).not.toContain('m-plus-rounded')
  })

  it('keeps the page base free of a saturated gradient', () => {
    // The old sky-blue page gradient is the single loudest "children's web game" tell.
    expect(css).not.toContain('#7fd3ff')
    expect(css).not.toContain('#bfe6ff')
  })
})
