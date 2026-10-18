// Holds the game port for the shell (T137): a quiet booting port at first, then the one `boot` resolves, or a port that
// says why the save couldn't open. Owns the one 30-second clock, which reads the port's `now` and also ticks whenever the
// port publishes, so a tap's result shows at once. Each port gets its clock from its own `now` (T142): the first render
// over a loaded save already reads its time, never the booting port's (a seed's clock differs from the device's).
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClock } from './clock'
import { BOOTING_GAME, errorGame, RuntimeContext, type G2Game, type G2Rules, type G2Runtime } from './game'
import { hubWords } from '@racer/domain/hub'
import { RacerAlbumArtProvider } from './albumArt'

interface Loaded {
  readonly game: G2Game
  readonly rules: G2Rules | null
}

export function GameProvider({ boot, game, rules = null, children }: {
  /** Loads the port and the rules once: the session's `bootSaveGame`, or the seeds' `bootGame`. */
  boot?: () => Promise<{ readonly game: G2Game; readonly rules: G2Rules }>
  /** A port given outright (tests). */
  game?: G2Game
  rules?: G2Rules | null
  children: ReactNode
}) {
  const [loaded, setLoaded] = useState<Loaded>({ game: game ?? BOOTING_GAME, rules })

  useEffect(() => {
    if (game !== undefined) {
      setLoaded({ game, rules })
      return
    }
    if (boot === undefined) return
    let live = true
    boot().then(
      (next) => { if (live) setLoaded(next) },
      () => { if (live) setLoaded({ game: errorGame(hubWords('save-error-reason')), rules: null }) },
    )
    return () => { live = false }
  }, [boot, game, rules])

  const clock = useMemo(() => createClock(() => loaded.game.now()), [loaded.game])
  useEffect(() => loaded.game.subscribe(() => clock.tick()), [loaded.game, clock])
  useEffect(() => clock.tick(), [loaded.game, clock])

  const runtime = useMemo<G2Runtime>(() => ({ game: loaded.game, rules: loaded.rules, clock }), [loaded, clock])
  return <RuntimeContext.Provider value={runtime}><RacerAlbumArtProvider>{children}</RacerAlbumArtProvider></RuntimeContext.Provider>
}
