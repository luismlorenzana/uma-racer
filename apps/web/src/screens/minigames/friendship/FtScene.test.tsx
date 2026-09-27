// @vitest-environment jsdom
// The run's scene and season track (D183): a card whose character is not an Uma still shows someone, and the track
// says where the run is.
import type { FtSetup, FtState } from '@racer/domain'
import { cleanup, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../../../content/runtime'
import { FtScene, SeasonMap } from './FtScene'

const content = {
  umas: { items: [] },
  art: { has: () => false, load: async () => null },
  atlases: {
    'card-icons': {
      descriptor: { pages: [{ path: 'atlases/card-icons-0.x.webp', width: 132, height: 132 }], frames: { riko: { page: 0, x: 2, y: 2, width: 128, height: 128 } } },
      pageUrls: ['blob:card-icons'],
    },
  },
} as unknown as LoadedContent

const setup = {
  mainCardId: 'riko',
  cards: { riko: { id: 'riko', name: 'Riko Kashimoto', charaId: '9001', type: 'friend' } },
  races: [{ id: 'r1', grade: 'g3' }, { id: 'r2', grade: 'g2' }],
} as unknown as FtSetup
const state = { phase: 'facility', stage: 0, week: 0, weeksTrained: [], gauge: 1, bonded: false } as unknown as FtState

afterEach(cleanup)

describe('Friendship Training scene', () => {
  it('shows a staff card’s own icon when the character has no chibi or face, in a compact strip', () => {
    const view = render(<LazyMotion features={domAnimation} strict><FtScene content={content} setup={setup} state={state} place={{ kind: 'rest' }} compact /></LazyMotion>)
    expect(screen.getByRole('img', { name: 'Riko Kashimoto' })).toBeTruthy()
    expect(view.container.firstElementChild?.className).toContain('h-28')
    expect(screen.getByText('Friendship 1/3')).toBeTruthy()
  })

  it('says where the run is: the week, the stage and what comes next', () => {
    render(<SeasonMap setup={setup} state={state} />)
    expect(screen.getByText('Training week 1')).toBeTruthy()
    expect(screen.getByText('Stage 1 of 2 · two weeks, then the G3 race')).toBeTruthy()
    expect(screen.getByLabelText('Week 1, now')).toBeTruthy()
    expect(screen.getByText('0 / 6')).toBeTruthy()
  })
})
