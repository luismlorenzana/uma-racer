// @vitest-environment jsdom
// The Paddock primitives as rendered DOM (T031): every button face and its disabled state, the chip's and segmented
// control's selection, the art tile's fallbacks, and the placeholder's accessible name.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArtTile } from './ArtTile'
import { Button, type ButtonVariant } from './Button'
import { Chip } from './Chip'
import { Placeholder } from './Placeholder'
import { SegmentedControl } from './SegmentedControl'

const withMotion = (node: ReactNode) => render(<LazyMotion features={domAnimation} strict>{node}</LazyMotion>)

afterEach(cleanup)

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

describe('SegmentedControl', () => {
  it('marks the chosen option and reports a new one', () => {
    const onChange = vi.fn()
    withMotion(<SegmentedControl label="View" value="icons" onChange={onChange} options={[{ value: 'icons', label: 'Icons' }, { value: 'list', label: 'List' }]} />)
    expect(screen.getByRole('tab', { name: 'Icons' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'List' }))
    expect(onChange).toHaveBeenCalledWith('list')
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
