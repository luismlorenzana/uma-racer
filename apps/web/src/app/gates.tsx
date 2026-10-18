// Getting in (SD4; docs/game/11-hub-and-places.md §2.4): uma-kit's `BootGates` around the live routes, in both games'
// order: the splash, Google sign-in when nobody is signed in, the boot (the session's: content, then the device save),
// then the start page, opened once and only when the app was opened at `/`. uma-racer has no first-launch step: a new
// account's start page is the Stable's Locked tab. A boot that stops shows the session's words and button. The seeds'
// mount and the tests render the routes without these gates.
import { useAuth } from '@luismlorenzana/uma-kit/auth'
import { BootGates } from '@luismlorenzana/uma-kit/places'
import { Outlet } from 'react-router'
import { useSessionGates } from './session'

export const GATE_WORDS = { name: 'Uma Racer', tagline: 'Race, Farm, Train.' } as const

export function LiveGates() {
  const auth = useAuth()
  const gates = useSessionGates()
  if (gates === null) return <Outlet />
  const failure = gates.failure
  return (
    <BootGates
      auth={auth}
      boot={() => gates.boot()}
      startPath={gates.startPath}
      words={failure === null ? GATE_WORDS : { ...GATE_WORDS, bootFailed: failure.words, retry: failure.retry }}
    >
      <Outlet />
    </BootGates>
  )
}
