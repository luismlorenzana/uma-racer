// uma-kit's setup for uma-racer (T147; docs/game/architecture.md "uma-kit"): the shared shell, Hub and primitives keep
// their device preferences (Appearance, reduced motion) under uma-racer's own `uma-racer:g2:` prefix, beside the game's
// other device keys (race speed, last page, album prefs). SE1 retires the first-boot wipe without changing any key.
// `setupKit` runs once at boot, before the first render: the prefix, then the stored Appearance on `<html data-theme>`.
import { configureKit, initAppearance } from '@luismlorenzana/uma-kit/ui'

/** Every device key uma-racer writes starts with this, the kit's included. */
export const DEVICE_PREFIX = 'uma-racer:g2:'

/** Account's Reduce motion switch: the kit's `reducedMotion` under the prefix, the key T138 chose. */
export const REDUCED_MOTION_KEY = `${DEVICE_PREFIX}reducedMotion`

/** Account's Appearance (System, Light or Dark): the kit's `appearance` under the prefix; absent means System. */
export const APPEARANCE_KEY = `${DEVICE_PREFIX}appearance`

export const configureRacerKit = (): void => configureKit({ storagePrefix: DEVICE_PREFIX })

export function setupKit(): void {
  configureRacerKit()
  initAppearance()
}
