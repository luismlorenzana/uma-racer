// A play for her career (D387), `/career/careers/:careerId/play/:kind`, full screen: the stage host, opened from the
// season's Play step or the header's Play again. Play pays into her wallet (a replay pays like a first play) and every
// settled play is remembered on this phone for the season card's check; a completed career's plays are practice.
// Leaving returns to her career page. Its own chunk, with the games' rules.
import { useLeave } from '@luismlorenzana/uma-kit/shell'
import type { StageKind } from '@racer/domain/stages'
import { useGame } from '../../app/game'
import { careerPath } from '../../hub/nav'
import { StageHost } from '../../stages/StageHost'
import { recordPlay } from './plays'

export default function PlayPage({ careerId, kind }: { careerId: string; kind: StageKind }) {
  const leave = useLeave()
  const completed = useGame((snapshot) => snapshot.state?.careers[careerId]?.completedAt != null)
  return (
    <StageHost kind={kind} careerId={careerId} mode={completed ? 'practice' : 'career'} onExit={() => leave(careerPath(careerId))}
      onSettled={recordPlay} />
  )
}
