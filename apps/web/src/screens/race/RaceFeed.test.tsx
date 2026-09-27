// @vitest-environment jsdom
// The race feed (D178) is a pure view of the HUD's live toasts: nothing outlives its moment, and a folded rival count
// only counts what has already happened.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import type { RaceCue } from '../../scenes/race/presentation'
import { RaceFeed } from './RaceFeed'

const content = { umas: { byId: new Map() }, skills: { byId: new Map() } } as unknown as LoadedContent
const runners = [{ templateId: 'you', isPlayer: true }, { templateId: 'a', isPlayer: false }, { templateId: 'b', isPlayer: false }]
const cue = (overrides: Partial<RaceCue>): RaceCue => ({
  id: 0, kind: 'pack', runner: 0, tick: 0, startSeconds: 0, endSeconds: 3, folded: [], isPlayer: true, ...overrides,
})
const toasts = () => [...document.querySelectorAll('.race-toast-in')].map((toast) => toast.textContent)

afterEach(cleanup)

describe('race feed', () => {
  it('stacks the live toasts newest first and drops each one as soon as the HUD does', () => {
    const lateStart = cue({ id: 0, kind: 'late-start', runner: 1, isPlayer: false, folded: [0] })
    const paceDown = cue({ id: 1, packKind: 'Pace down', startSeconds: 2, endSeconds: 5 })
    const view = render(<RaceFeed cues={[paceDown, lateStart]} seconds={2.1} content={content} runners={runners} />)
    expect(toasts()).toEqual(['PackPace down', 'Field start2 rivals started late'])
    view.rerender(<RaceFeed cues={[paceDown]} seconds={3.2} content={content} runners={runners} />)
    expect(toasts()).toEqual(['PackPace down'])
    view.rerender(<RaceFeed cues={[]} seconds={5} content={content} runners={runners} />)
    expect(toasts()).toEqual([])
  })

  it('counts a folded rival only once it has happened, and fades a toast over the last fifth of its life', () => {
    const lateStart = cue({ kind: 'late-start', runner: 1, isPlayer: false, startSeconds: 0, endSeconds: 10, folded: [1, 4] })
    const view = render(<RaceFeed cues={[lateStart]} seconds={2} content={content} runners={runners} />)
    expect(toasts()).toEqual(['Field start2 rivals started late'])
    const row = () => document.querySelector<HTMLElement>('.race-toast-in')!.parentElement!
    expect(row().style.opacity).toBe('1')
    view.rerender(<RaceFeed cues={[lateStart]} seconds={8.5} content={content} runners={runners} />)
    expect(toasts()).toEqual(['Field start3 rivals started late'])
    expect(row().style.opacity).toBe('0')
  })
})
