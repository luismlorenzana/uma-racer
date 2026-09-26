// The icon set's contract (T032): one module per named icon, every icon on the 24 grid in currentColor, only the
// sanctioned fills, and an accessible name or aria-hidden.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import * as barrel from './index'
import { ICON_NAMES, type IconComponent, type IconVariant } from './index'

const modules = import.meta.glob<Record<string, unknown>>(['./*Icon.tsx', '!./defineIcon.tsx'], { eager: true })
const sources = import.meta.glob<string>(['./*Icon.tsx', '!./defineIcon.tsx'], { eager: true, query: '?raw', import: 'default' })
const isIcon = (value: unknown): value is IconComponent => typeof value === 'function' && 'iconName' in value
const icons = Object.values(barrel).filter(isIcon)
const VARIANTS: IconVariant[] = ['line', 'solid', 'duotone']
const FILLS = new Set(['none', 'currentColor'])
const STYLE_FILLS = new Set(['currentColor', 'var(--icon-tone, var(--color-accent))'])

describe('icon set', () => {
  it('has one module per name, exported through the barrel under its own name', () => {
    expect(icons.map((icon) => icon.iconName).sort()).toEqual([...ICON_NAMES].sort())
    expect(new Set(icons.map((icon) => icon.iconName)).size).toBe(icons.length)
    for (const [file, exports] of Object.entries(modules)) {
      const exported = Object.entries(exports)
      expect(exported, file).toHaveLength(1)
      const [exportName, icon] = exported[0]!
      expect(`./${exportName}.tsx`).toBe(file)
      expect(isIcon(icon) && barrel[exportName as keyof typeof barrel]).toBe(icon)
    }
    expect(Object.keys(modules)).toHaveLength(ICON_NAMES.length)
  })

  it('marks every definition pure, so a screen ships only the icons it draws', () => {
    for (const [file, source] of Object.entries(sources)) expect(source, file).toContain('= /* @__PURE__ */ defineIcon(')
  })

  it('renders every icon at 24 px on the grid, in currentColor, with only the sanctioned fills', () => {
    for (const Icon of icons) {
      for (const variant of VARIANTS) {
        const markup = renderToStaticMarkup(<Icon variant={variant} />)
        expect(markup).toContain('viewBox="0 0 24 24"')
        expect(markup).toContain('width="24"')
        expect(markup).toContain('stroke="currentColor"')
        expect(markup, `${Icon.iconName} ${variant}`).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
        for (const [, fill] of markup.matchAll(/ fill="([^"]*)"/g)) expect(FILLS, `${Icon.iconName}: fill="${fill}"`).toContain(fill)
        for (const [, fill] of markup.matchAll(/fill:\s*([^;"]+)/g)) expect(STYLE_FILLS, `${Icon.iconName}: fill:${fill}`).toContain(fill!.trim())
      }
    }
  })

  it('draws the tab and currency icons in two tones', () => {
    const twoTone = ['home', 'stable', 'race', 'cards', 'badges', 'ticket', 'card-coupon', 'uma-coupon']
    for (const Icon of icons.filter((icon) => twoTone.includes(icon.iconName))) {
      expect(renderToStaticMarkup(<Icon variant="duotone" />), Icon.iconName).toContain('var(--icon-tone, var(--color-accent))')
    }
  })

  it('is decorative unless it is given a name', () => {
    const Icon = icons[0]!
    expect(renderToStaticMarkup(<Icon />)).toContain('aria-hidden="true"')
    const named = renderToStaticMarkup(<Icon title="Training Tickets" size={16} />)
    expect(named).toContain('role="img"')
    expect(named).toContain('aria-label="Training Tickets"')
    expect(named).toContain('width="16"')
    expect(renderToStaticMarkup(<Icon variant="duotone" accent="var(--color-panel)" />)).toContain('--icon-tone:var(--color-panel)')
  })

  it('keeps the drawings stable', () => {
    expect(Object.fromEntries(icons.map((Icon) => [Icon.iconName, renderToStaticMarkup(<Icon />)]))).toMatchSnapshot()
  })
})
