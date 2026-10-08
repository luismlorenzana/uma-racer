// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import { RpgPortrait, WEAPON_TONE, WeaponPair } from './RpgPortrait'

afterEach(cleanup)

describe('RPG portrait identity', () => {
  it('names both weapons even when private portrait art is unavailable', () => {
    render(<RpgPortrait content={null} outfitId="invented-outfit" name="Invented Uma" weapons={['arcane-staff', 'cleric-staff']} />)
    expect(screen.getByRole('img', { name: 'Portrait unavailable' })).toBeTruthy()
    expect(screen.getByText('Arcane Staff')).toBeTruthy()
    expect(screen.getByText('Cleric Staff')).toBeTruthy()
    expect(screen.getAllByText('Invented Uma')).toHaveLength(1)
  })

  it('shows a dual wielder as two weapon icons side by side, named for assistive technology', () => {
    render(<RpgPortrait content={null} compact artwork="icon" outfitId="invented-outfit" name="Invented Uma" weapons={['mage-staff', 'short-sword']} />)
    expect(screen.getByRole('img', { name: 'Invented Uma, Mage Staff + Short Sword' }).querySelectorAll('svg')).toHaveLength(2)
    expect(screen.queryByText('Mage Staff')).toBeNull()
    cleanup()
    render(<RpgPortrait content={null} compact artwork="icon" outfitId="invented-outfit" name="Invented Uma" weapons={['summoner-tome']} />)
    expect(screen.getByRole('img', { name: 'Invented Uma, Summoner Tome' }).querySelectorAll('svg')).toHaveLength(1)
  })

  it('colors weapons by family: Brawler red, Mage green, Arcane yellow, Cleric blue, Summoner purple', () => {
    const { container } = render(<WeaponPair weapons={['greatsword', 'mage-staff', 'arcane-staff', 'cleric-staff', 'summoner-tome']} />)
    expect([...container.querySelectorAll('svg')].map((svg) => svg.style.color)).toEqual(
      ['rgb(255, 107, 94)', 'rgb(95, 211, 138)', 'rgb(255, 213, 79)', 'rgb(108, 180, 255)', 'rgb(196, 139, 255)'])
    expect(new Set([WEAPON_TONE.greatsword, WEAPON_TONE.spear, WEAPON_TONE.axe, WEAPON_TONE.bow]).size).toBe(1)
    expect(WEAPON_TONE['short-sword']).toBe(WEAPON_TONE['mage-staff'])
  })

  it('uses the small private icon atlas without requesting large bust art in the roster', () => {
    const has = vi.fn(() => true), load = vi.fn()
    // Minimal invented loader: this portrait reads only atlases/art, not game registries.
    const content = { art: { has, load }, atlases: { 'uma-icons': {
      pageUrls: ['https://invalid.test/invented-atlas.webp'], descriptor: {
        pages: [{ width: 128, height: 128 }], frames: { 'invented-outfit': { page: 0, x: 0, y: 0, width: 64, height: 64 } },
      },
    } } } as unknown as LoadedContent
    const { container } = render(<RpgPortrait content={content} compact artwork="icon" outfitId="invented-outfit" name="Invented Uma" weapons={['greatsword', 'spear']} />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://invalid.test/invented-atlas.webp')
    expect(has).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })
})
