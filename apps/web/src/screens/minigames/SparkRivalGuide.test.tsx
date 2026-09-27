// @vitest-environment jsdom
import { SPARK_RIVAL_MOVEMENT_MS, SPARK_RIVAL_TURNS_PER_WAVE } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SparkRivalGuide, rememberSparkRivalGuideSeen, sparkRivalGuideSeen } from './SparkRivalGuide'

const guide = (props: Partial<Parameters<typeof SparkRivalGuide>[0]> = {}) => render(
  <LazyMotion features={domAnimation} strict>
    <SparkRivalGuide open onClose={() => undefined} {...props} />
  </LazyMotion>,
)
const title = () => document.getElementById('spark-rival-guide-title')?.textContent

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Spark Rival guide', () => {
  it('uses the shared paged model and teaches the whole circuit in order', () => {
    guide()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(title()).toBe('Break three rivals’ Resolve')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(title()).toBe('Move one orb through the board')
    expect(document.body.textContent).toContain(`${SPARK_RIVAL_MOVEMENT_MS / 1_000}-second movement clock`)
  })

  it('opens Matchups directly and states the complete advantage contract in text', () => {
    guide({ startAt: 'advantage' })
    expect(title()).toBe('Read the matchup ring')
    expect(document.body.textContent).toContain('Pace → Front → End → Late → Pace')
    expect(document.body.textContent).toContain('×1.5')
    expect(document.body.textContent).toContain('×0.67')
  })

  it('reads the wave turn limit from the rules module and closes from the last page', () => {
    const onClose = vi.fn()
    guide({ startAt: 'intent', onClose })
    expect(document.body.textContent).toContain(`${SPARK_RIVAL_TURNS_PER_WAVE} drags`)
    cleanup()
    guide({ startAt: 'rewards', onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Let’s spar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('remembers that the free guide has opened on this device', () => {
    expect(sparkRivalGuideSeen()).toBe(false)
    rememberSparkRivalGuideSeen()
    expect(sparkRivalGuideSeen()).toBe(true)
  })
})
