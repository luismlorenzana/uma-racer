import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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

  it('has dropped the Racecourse Pop aliases, and no screen still reaches for them or the slab button (T031)', () => {
    for (const alias of ['--color-sky', '--color-cream', '--color-gold:', '--color-gold-deep', '--color-turf-deep']) expect(css).not.toContain(alias)
    const root = fileURLToPath(new URL('..', import.meta.url))
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(path)
      }
    }
    walk(root)
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /\b(?:bg|text|border|from|to|via)-(?:sky|sky-top|sky-deep|cream|gold|gold-deep|turf-deep)\b/.test(source) || /\bGameButton\b/.test(source)
    })
    expect(offenders).toEqual([])
  })
})
