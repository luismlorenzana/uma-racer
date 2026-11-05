// @vitest-environment jsdom
// uma-kit's device keys under uma-racer's prefix (T147, T152; app/kit.ts): generation 3's `uma-racer:g3:`, which every
// device key shares (the save's boot wipes generation 2's once), Appearance beside Reduce motion, and a stored Appearance
// on `<html>` from boot.
import { initAppearance, kitKey, readAppearance, setAppearance, setReducedMotion, deviceReducedMotion } from '@luismlorenzana/uma-kit/ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryStorage } from '../__fixtures__/testing'
import { RACE_SPEED_KEY } from '../ui/devicePrefs'
import { WIPED_KEY } from '../save/db'
import { PULL_KEY } from '../save/sync'
import { MASTER_SNAPSHOT } from './contentRuntime'
import { LAST_PAGE_KEY } from './start'
import { APPEARANCE_KEY, configureRacerKit, DEVICE_PREFIX, REDUCED_MOTION_KEY, setupKit } from './kit'

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  configureRacerKit()
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe("uma-kit's storage prefix", () => {
  it("is uma-racer's generation-3 prefix, which every other device key shares", () => {
    expect(DEVICE_PREFIX).toBe('uma-racer:g3:')
    expect(kitKey('reducedMotion')).toBe(REDUCED_MOTION_KEY)
    expect(kitKey('appearance')).toBe(APPEARANCE_KEY)
    for (const key of [REDUCED_MOTION_KEY, APPEARANCE_KEY, RACE_SPEED_KEY, LAST_PAGE_KEY, PULL_KEY, MASTER_SNAPSHOT, WIPED_KEY, kitKey('album:')]) {
      expect(key.startsWith(DEVICE_PREFIX), key).toBe(true)
    }
  })

  it("keeps Account's Reduce motion under the prefix", () => {
    localStorage.setItem('uma-racer:g3:reducedMotion', 'true')
    expect(deviceReducedMotion()).toBe(true)
    setReducedMotion(false)
    expect(localStorage.getItem('uma-racer:g3:reducedMotion')).toBeNull()
    setReducedMotion(true)
    expect(localStorage.getItem('uma-racer:g3:reducedMotion')).toBe('true')
  })

  it('stores Appearance beside it, System as no key at all', () => {
    expect(readAppearance()).toBe('system')
    setAppearance('dark')
    expect(localStorage.getItem('uma-racer:g3:appearance')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    setAppearance('system')
    expect(localStorage.getItem('uma-racer:g3:appearance')).toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('applies a stored Appearance at boot', () => {
    localStorage.setItem(APPEARANCE_KEY, 'dark')
    setupKit()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    localStorage.setItem(APPEARANCE_KEY, 'light')
    initAppearance()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
