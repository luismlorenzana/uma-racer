// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import { RpgElementLegend, RpgPortrait } from './RpgPortrait'

afterEach(cleanup)

describe('RPG portrait identity', () => {
  it('names weapon and signature even when private portrait art is unavailable', () => {
    render(<RpgPortrait content={null} outfitId="invented-outfit" name="Invented Uma"
      weapon="cleric-staff" element="light" />)
    expect(screen.getByRole('img', { name: 'Portrait unavailable' })).toBeTruthy()
    expect(screen.getByText('Cleric staff')).toBeTruthy()
    expect(screen.getByText('Light')).toBeTruthy()
    expect(screen.getAllByText('Invented Uma')).toHaveLength(1)
  })

  it('explains the matchup and B-depth limit in a toggleable text legend', () => {
    render(<RpgElementLegend />)
    const toggle = screen.getByRole('button', { name: 'Show element guide' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByText(/Fire beats Ice/)).toBeTruthy()
    expect(screen.getByText(/B opens depths 1–3/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide element guide' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps compact weapon/element identity icon-only but named for assistive technology', () => {
    render(<RpgPortrait content={null} compact artwork="icon" outfitId="invented-outfit" name="Invented Uma" weapon="tome" element="dark" />)
    expect(screen.getByRole('img', { name: 'Invented Uma, Magic tome, Dark' }).querySelectorAll('svg')).toHaveLength(2)
    expect(screen.queryByText('Magic tome')).toBeNull()
    expect(screen.queryByText('Dark')).toBeNull()
  })

  it('uses the small private icon atlas without requesting large bust art in the roster', () => {
    const has = vi.fn(() => true), load = vi.fn()
    // Minimal invented loader: this portrait reads only atlases/art, not game registries.
    const content = { art: { has, load }, atlases: { 'uma-icons': {
      pageUrls: ['https://invalid.test/invented-atlas.webp'], descriptor: {
        pages: [{ width: 128, height: 128 }], frames: { 'invented-outfit': { page: 0, x: 0, y: 0, width: 64, height: 64 } },
      },
    } } } as unknown as LoadedContent
    const { container } = render(<RpgPortrait content={content} compact artwork="icon" outfitId="invented-outfit" name="Invented Uma" weapon="spear" element="ice" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://invalid.test/invented-atlas.webp')
    expect(has).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })
})
