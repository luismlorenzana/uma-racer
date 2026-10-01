// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
})
