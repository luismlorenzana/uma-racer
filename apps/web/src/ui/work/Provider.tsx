// Loaded only with a work place/check-in, not with the startup shell. SC5 injects Racer's content, rules and port.
import { WorkArtProvider, WorkProvider } from '@luismlorenzana/uma-kit/work'
import { sharedWorkEnv, racerRefusal } from '@racer/domain/work'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { useGame, useNow, useRuntime } from '../../app/game'
import { ItemIcon, itemIconScale } from '../ItemIcon'
import { checkRacerRestart, racerWorkActions, ticketOffer } from './actions'
import { useWordsContext } from './useTap'
import { itemName, placeName, showWords } from './words'
import type { BuildingId } from '@racer/domain/farm'

const art = { Item: ({ id, size }: { id: string; size: number }) => <ItemIcon item={id} scale={itemIconScale(size)} decorative /> }
const words = { workLevel: 'Farm Level', workLevelLabel: 'Farm Lv {level}', exp: '{n} Farm EXP',
  upgradeCost: '{amount} Prize Money', input: '{item} {have} of {need}', idle: '{time}, then free {idle} before a check-in',
  who: 'Free Umas', queueFor: 'Next job for {uma}' }

export function RacerWorkProvider({ children }: { children: ReactNode }) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const { game } = useRuntime()
  const context = useWordsContext()
  const native = useMemo(() => env === null ? null : sharedWorkEnv(env), [env])
  const actions = useMemo(() => racerWorkActions(game, context), [game, context])
  if (state === null || env === null || native === null) return null
  return <WorkProvider state={state} now={now} env={native} actions={actions} words={words}
    names={{ uma: context.umaName, item: itemName, place: (id) => placeName(id as BuildingId) }}
    formatRefusal={(value) => { const why = racerRefusal(value); return showWords({ text: why.reason, data: why.data ?? {} }, context) }}
    checkRestart={(current, id) => checkRacerRestart(current, id, now, env)}
    ticketOffer={(current, count) => ticketOffer(current, count, now, context)}>
    <WorkArtProvider art={art}>{children}</WorkArtProvider>
  </WorkProvider>
}

/** Keep the provider inside each lazy entry rather than pulling work screens into the entry chunk. */
export function withRacerWork<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return function RacerWorkEntry(props: P) { return <RacerWorkProvider><Component {...props} /></RacerWorkProvider> }
}

