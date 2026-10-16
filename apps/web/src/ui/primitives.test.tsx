// @vitest-environment jsdom
// The Paddock primitives as rendered DOM (T031): every button face and its disabled state, the chip's and segmented
// control's selection, the art tile's fallbacks, the placeholder's accessible name, and the sheet and art viewer
// opening at rest under Account's reduced motion.
import { BottomSheet, Button, type ButtonVariant, Chip, setReducedMotion as setDeviceReducedMotion } from '@luismlorenzana/uma-kit/ui'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArtTile } from './ArtTile'
import { ArtViewer } from './ArtViewer'
import { Placeholder } from './Placeholder'

const withMotion = (node: ReactNode) => render(<LazyMotion features={domAnimation} strict>{node}</LazyMotion>)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** This phone's storage for one test: Account's switch is a device key. */
function stubDevice(): void {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, String(value)),
    removeItem: (key: string) => void values.delete(key),
  })
}

describe('Button', () => {
  it('renders every variant as a real button with its face', () => {
    const faces: Record<ButtonVariant, string> = { primary: 'bg-accent', secondary: 'bg-panel', tertiary: 'bg-transparent', destructive: 'text-danger' }
    for (const [variant, face] of Object.entries(faces) as [ButtonVariant, string][]) {
      withMotion(<Button variant={variant}>{variant}</Button>)
      const button = screen.getByRole('button', { name: variant })
      expect(button.getAttribute('type')).toBe('button')
      expect(button.className).toContain(face)
    }
  })

  it('does not fire when disabled', () => {
    const onClick = vi.fn()
    withMotion(<Button disabled onClick={onClick}>Race</Button>)
    const button = screen.getByRole('button', { name: 'Race' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Chip', () => {
  it('states its selection for assistive tech, not by colour alone', () => {
    render(<><Chip selected>Turf</Chip><Chip>Dirt</Chip></>)
    expect(screen.getByRole('button', { name: 'Turf' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Dirt' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('ArtTile and Placeholder', () => {
  it('shows a labelled placeholder when there is no art, never an empty box', () => {
    render(<ArtTile asset={null} alt="Special Week portrait" />)
    expect(screen.getByRole('img', { name: 'Special Week portrait' })).toBeTruthy()
  })

  it('dims unowned art rather than hiding it', () => {
    render(<ArtTile asset={null} artUrl="blob:art" alt="Locked Uma" dimmed />)
    const image = screen.getByRole('img', { name: 'Locked Uma' })
    expect(image.className).toContain('opacity-45')
  })

  it('gives the placeholder its accessible name', () => {
    render(<Placeholder label="No card art" />)
    expect(screen.getByRole('img', { name: 'No card art' }).textContent).toContain('No card art')
  })
})

describe('reduced motion in the sheet and the art viewer', () => {
  // No MotionConfig here: what's checked is each component's own reading of the app's rule (`app/motion.tsx`).
  const open = () => {
    withMotion(<>
      <BottomSheet open onClose={() => undefined} label="A sheet"><p>Inside</p></BottomSheet>
      <ArtViewer src="blob:art" title="Full art" onClose={() => undefined} />
    </>)
    return { sheet: screen.getByRole('dialog', { name: 'A sheet' }), art: screen.getByRole('img', { name: 'Full art' }) }
  }

  it('slides the sheet up and grows the art in by default', () => {
    stubDevice()
    const { sheet, art } = open()
    expect(sheet.style.transform).toContain('100%')
    expect(art.style.transform).toContain('scale')
  })

  it("opens both at rest under Account's switch, which the system setting alone doesn't show", () => {
    stubDevice()
    setDeviceReducedMotion(true)
    const { sheet, art } = open()
    expect(sheet.style.transform).not.toContain('100%')
    expect(art.style.transform).not.toContain('scale')
    expect(art.style.opacity).not.toBe('0')
  })
})
