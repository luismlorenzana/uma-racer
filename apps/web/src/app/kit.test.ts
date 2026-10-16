// @vitest-environment jsdom
// uma-kit's device keys under uma-racer's prefix (T147; app/kit.ts): Account's Reduce motion keeps the key it always had,
// Appearance lands beside it, both survive the first-boot wipe (which deletes every other `uma-racer:` key), and a
// stored Appearance is on `<html>` from boot.
import { initAppearance, kitKey, readAppearance, setAppearance, setReducedMotion, deviceReducedMotion } from '@luismlorenzana/uma-kit/ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryStorage } from '../__fixtures__/testing'
import { WIPED_KEY, wipeOnce } from '../save/wipe'
import { RACE_SPEED_KEY } from '../ui/devicePrefs'
import { ALBUM_KEY_PREFIX } from '../ui/albumPrefs'
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
  it("is uma-racer's generation-2 prefix, which every other device key shares", () => {
    expect(DEVICE_PREFIX).toBe('uma-racer:g2:')
    expect(kitKey('reducedMotion')).toBe(REDUCED_MOTION_KEY)
    expect(kitKey('appearance')).toBe(APPEARANCE_KEY)
    for (const key of [REDUCED_MOTION_KEY, APPEARANCE_KEY, RACE_SPEED_KEY, LAST_PAGE_KEY, ALBUM_KEY_PREFIX, WIPED_KEY]) expect(key.startsWith(DEVICE_PREFIX), key).toBe(true)
  })

  it("keeps Account's Reduce motion where T138 stored it, so no phone's switch resets", () => {
    localStorage.setItem('uma-racer:g2:reducedMotion', 'true')
    expect(deviceReducedMotion()).toBe(true)
    setReducedMotion(false)
    expect(localStorage.getItem('uma-racer:g2:reducedMotion')).toBeNull()
    setReducedMotion(true)
    expect(localStorage.getItem('uma-racer:g2:reducedMotion')).toBe('true')
  })

  it('stores Appearance beside it, System as no key at all', () => {
    expect(readAppearance()).toBe('system')
    setAppearance('dark')
    expect(localStorage.getItem('uma-racer:g2:appearance')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    setAppearance('system')
    expect(localStorage.getItem('uma-racer:g2:appearance')).toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it("leaves the kit's keys to the first-boot wipe's survivors, and takes the old app's", async () => {
    localStorage.setItem(APPEARANCE_KEY, 'light')
    localStorage.setItem(REDUCED_MOTION_KEY, 'true')
    localStorage.setItem('uma-racer:theme', 'old')
    const result = await wipeOnce({
      storage: localStorage,
      deleteDatabase: async () => {},
      databaseNames: async () => [],
      caches: null,
      dev: false,
      now: () => 0,
    })
    expect(result).toBe('wiped')
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('light')
    expect(localStorage.getItem(REDUCED_MOTION_KEY)).toBe('true')
    expect(localStorage.getItem('uma-racer:theme')).toBeNull()
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
