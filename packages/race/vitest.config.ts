import { defineConfig } from 'vitest/config'

// The balance-style tests simulate hundreds of races; CI's shared runners take several times longer than a laptop.
export default defineConfig({
  test: {
    testTimeout: 60_000,
  },
})
