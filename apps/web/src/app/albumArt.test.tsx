// @vitest-environment jsdom
// SB6: synthetic content only. The shared art uses racer ids, verified loaders and held URLs, not public sources.
import { FaceTile, UmaBust, UmaChibi } from '@luismlorenzana/uma-kit/album'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../content/view'
import { seedGame } from '../__fixtures__/testing'
import { devRaceContent } from '../places/racing/content'
import { G2ContentContext } from './content'
import { GameProvider } from './GameProvider'
import { albumArtCandidates, outfitIcon } from './albumArt'

afterEach(cleanup)
const game = seedGame('fresh')
const content = () => devRaceContent(game.getSnapshot().env!)
const first = 'sim-uma-01', second = 'sim-uma-02'

function frame(data: LoadedContent, id: string, kind: 'face' | 'bust' | 'chibi' = 'face') {
  return <G2ContentContext.Provider value={data}><GameProvider game={game}>
    {kind === 'face' ? <FaceTile outfitId={id} label="Invented Uma" size={68} />
      : kind === 'bust' ? <UmaBust outfitId={id} label="Invented Uma" /> : <UmaChibi outfitId={id} label="Invented Uma" />}
  </GameProvider></G2ContentContext.Provider>
}

describe('the racer album art port', () => {
  it('maps faces, busts and chibis to outfit identity without substituting character-level crops', () => {
    const data = content()
    expect(albumArtCandidates(data, 'face', first)).toEqual([{ kind: 'face', id: first }])
    expect(albumArtCandidates(data, 'face', 'absent')).toEqual([])
    expect(albumArtCandidates(data, 'bust', first)).toEqual([{ kind: 'bust', id: first }])
    expect(albumArtCandidates(data, 'chibi', first)).toEqual([{ kind: 'chibi', id: `${first}-a` }, { kind: 'bust', id: first }])
    expect(albumArtCandidates(data, 'icon', first)).toEqual([])
  })

  it('holds art before loading, keeps a new outfit from flashing the old face, and releases each hold', async () => {
    const data = content()
    const release = vi.fn()
    const character = first
    let resolveSecond: (url: string | null) => void = () => {}
    const next = new Promise<string | null>((resolve) => { resolveSecond = resolve })
    const events: string[] = []
    data.art = { has: () => true, hold: (kind, id) => { events.push(`hold:${kind}:${id}`); return release },
      load: vi.fn(async (kind, id) => { events.push(`load:${kind}:${id}`); return id === character ? 'blob:first-face' : next }) }
    const ui = render(frame(data, first))
    await waitFor(() => expect(ui.container.querySelector('img')?.getAttribute('src')).toBe('blob:first-face'))
    expect(events.slice(0, 2)).toEqual([`hold:face:${character}`, `load:face:${character}`])
    ui.rerender(frame(data, second))
    expect(ui.container.querySelector('img')).toBeNull()
    await act(async () => { resolveSecond('blob:second-face'); await next })
    await waitFor(() => expect(ui.container.querySelector('img')?.getAttribute('src')).toBe('blob:second-face'))
    ui.unmount()
    expect(release).toHaveBeenCalledTimes(2)
  })

  it('keeps the outfit icon after a failed bust and never asks for chibis on a bust surface', async () => {
    const data = content()
    const atlas = data.atlases['uma-icons']
    data.atlases['uma-icons'] = { descriptor: { ...atlas.descriptor,
      pages: [{ path: 'invented.webp', width: 128, height: 128 }],
      frames: { [first]: { page: 0, x: 0, y: 0, width: 128, height: 128 } },
    }, pageUrls: ['blob:invented-atlas'] }
    const load = vi.fn(async () => { throw new Error('hash mismatch') })
    data.art = { has: () => true, load }
    expect(outfitIcon(data, first)?.url).toBe('blob:invented-atlas')
    expect(outfitIcon(data, 'absent')).toBeNull()
    const ui = render(frame(data, first, 'bust'))
    await waitFor(() => expect(load).toHaveBeenCalledWith('bust', first))
    expect(load).toHaveBeenCalledTimes(1)
    expect(ui.container.querySelector('img')?.getAttribute('src')).toBe('blob:invented-atlas')
  })
})
