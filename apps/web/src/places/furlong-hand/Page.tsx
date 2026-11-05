// The Hub's Furlong Hand place (docs/game/11-hub-and-places.md, docs/game/09-furlong-hand.md; T156, D387): the race's
// free practice, full screen, which pays nothing; a career's own plays open from its page (Play, or Play again).
// Practice borrows her running career (the most recently started): its deck, her racing build and her next race, else
// an Uma alone on her best course.
import { useLeave } from '@luismlorenzana/uma-kit/shell'
import { careerId as careerIdOf } from '@racer/domain/save'
import { useGame } from '../../app/game'
import { StageHost } from '../../stages/StageHost'
import type { PageProps } from '../registry'

export default function FurlongHandPage({ place }: PageProps) {
  const leave = useLeave()
  const careerId = useGame((snapshot) => {
    const running = Object.values(snapshot.state?.careers ?? {}).filter((career) => career.completedAt === null)
    const latest = running.sort((a, b) => b.startedAt - a.startedAt)[0]
    return latest === undefined ? null : careerIdOf(latest.umaId, latest.T)
  })
  return <StageHost kind="furlong-hand" careerId={careerId} mode="practice" onExit={() => leave(`/${place.page}`)} />
}
