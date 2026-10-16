// Every test file's setup (vite.config.ts `test.setupFiles`): uma-kit's device keys under uma-racer's prefix, as
// `main.tsx`'s `setupKit` sets them before the first render (app/kit.ts).
import { configureRacerKit } from '../app/kit'

configureRacerKit()
