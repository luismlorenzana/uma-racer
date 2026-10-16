import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The Paddock system is a contract (docs/design/visual-system.md): a renamed or dropped token must fail loudly here
// rather than silently rendering an unstyled screen. Since T147 the tokens are uma-kit's theme, in light and dark under
// the same names; `index.css` imports it, lets Tailwind read the kit's classes, and keeps uma-racer's fonts.
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')
const theme = readFileSync(createRequire(import.meta.url).resolve('@luismlorenzana/uma-kit/theme.css'), 'utf8')

const TOKENS = [
  '--font-display', '--font-ui',
  '--color-page', '--color-panel', '--color-raised', '--color-sunken', '--color-stage', '--color-stage-soft', '--color-scrim',
  '--color-ink', '--color-ink-soft', '--color-ink-faint', '--color-ink-on-dark', '--color-ink-on-dark-soft',
  '--color-accent', '--color-accent-strong', '--color-accent-wash', '--color-accent-ink', '--color-turf', '--color-dirt',
  '--color-stat-speed', '--color-stat-stamina', '--color-stat-power', '--color-stat-guts', '--color-stat-wit',
  '--color-tier-bronze', '--color-tier-silver', '--color-tier-gold', '--color-tier-platinum',
  '--color-success', '--color-danger', '--color-warning', '--color-info', '--color-locked',
  '--color-hairline', '--color-hairline-strong', '--color-hairline-dark',
  '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--chamfer',
  '--shadow-1', '--shadow-2', '--shadow-3',
  '--duration-fast', '--duration-standard', '--duration-emphasised', '--ease-standard',
]

/** The tokens dark mode redefines: every surface, ink and accent a screen draws with. */
const DARK = ['--color-page', '--color-panel', '--color-raised', '--color-sunken', '--color-ink', '--color-ink-soft', '--color-ink-faint', '--color-accent', '--color-accent-wash', '--color-hairline']

const UTILITIES = ['.text-micro', '.numeral', '.numeral-on-dark', '.chamfer-tr', '.art-scrim', '.font-display', '.pt-safe', '.pb-safe', '.mb-bar-safe', '.scroll-strip']

describe('paddock tokens', () => {
  it("imports uma-kit's theme after Tailwind and lets Tailwind read the kit's classes", () => {
    expect(css.indexOf("@import 'tailwindcss'")).toBeLessThan(css.indexOf("@import '@luismlorenzana/uma-kit/theme.css'"))
    expect(css).toContain("@source '../node_modules/@luismlorenzana/uma-kit/dist'")
  })

  it('defines every documented token', () => {
    const missing = TOKENS.filter((token) => !theme.includes(`${token}:`))
    expect(missing).toEqual([])
  })

  it('redefines the surfaces, inks and accent in dark, for the phone and for Account\'s choice alike', () => {
    const block = (selector: string) => theme.slice(theme.indexOf(selector), theme.indexOf('}', theme.indexOf(selector)))
    for (const selector of ["[data-theme='dark'] {", ":root:not([data-theme='light']) {"]) {
      expect(theme).toContain(selector)
      expect(DARK.filter((token) => !block(selector).includes(`${token}:`)), selector).toEqual([])
    }
  })

  it('defines the utilities components rely on', () => {
    const missing = UTILITIES.filter((utility) => !theme.includes(`${utility} {`))
    expect(missing).toEqual([])
  })

  it('loads both faces from latin-only variable subsets', () => {
    expect(css).toContain('outfit-latin-wght-normal.woff2')
    expect(css).toContain('inter-latin-wght-normal.woff2')
    expect(css).not.toContain('m-plus-rounded')
  })

  it('stills the Ready pip and the numbers under reduced motion, from the device switch and the system alike', () => {
    expect(theme).toMatch(/:root\[data-reduced-motion\] \.kit-number,\s*:root\[data-reduced-motion\] \.kit-pip-ready \{\s*transition: none;\s*animation: none;/)
    expect(theme).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('animates transform and opacity only, in both files', () => {
    for (const file of [css, theme]) {
      for (const [, body] of file.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
        for (const [, property] of body!.matchAll(/([\w-]+)\s*:/g)) expect(['transform', 'opacity', 'from', 'to']).toContain(property)
      }
    }
  })

  it('keeps the page base free of a saturated gradient', () => {
    // The old sky-blue page gradient is the single loudest "children's web game" tell.
    for (const file of [css, theme]) {
      expect(file).not.toContain('#7fd3ff')
      expect(file).not.toContain('#bfe6ff')
    }
  })

  it('has dropped the Racecourse Pop aliases, and no screen still reaches for them or the slab button (T031)', () => {
    for (const alias of ['--color-sky', '--color-cream', '--color-gold:', '--color-gold-deep', '--color-turf-deep']) expect(css + theme).not.toContain(alias)
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
