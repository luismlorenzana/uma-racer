// Device-local one-time guide memory (docs/design/minigame-kit.md#8-the-guide).
export interface GuideMemory {
  seen(): boolean
  remember(): void
}

export function createGuideMemory(key: string): GuideMemory {
  return {
    seen() {
      try {
        return globalThis.localStorage?.getItem(key) === '1'
      } catch {
        return false
      }
    },
    remember() {
      try {
        globalThis.localStorage?.setItem(key, '1')
      } catch {
        // A blocked store only means the free guide opens again next visit.
      }
    },
  }
}
