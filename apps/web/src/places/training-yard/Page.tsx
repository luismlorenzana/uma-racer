// The Hub's Training Yard place (docs/game/11-hub-and-places.md, docs/game/08-training-yard.md; T155): until the career
// screens (T158) open the Yard for a career's season, the place opens it full screen as practice, which pays nothing.
// Practice borrows her running career's deck when she has one (the most recently started), else an Uma alone.
import { useLeave } from '@luismlorenzana/uma-kit/shell'
import { careerId as careerIdOf } from '@racer/domain/save'
import { useGame } from '../../app/game'
import { StageHost } from '../../stages/StageHost'
import type { PageProps } from '../registry'

export default function TrainingYardPage({ place }: PageProps) {
  const leave = useLeave()
  const careerId = useGame((snapshot) => {
    const running = Object.values(snapshot.state?.careers ?? {}).filter((career) => career.completedAt === null)
    const latest = running.sort((a, b) => b.startedAt - a.startedAt)[0]
    return latest === undefined ? null : careerIdOf(latest.umaId, latest.T)
  })
  return <StageHost kind="training-yard" careerId={careerId} mode="practice" onExit={() => leave(`/${place.page}`)} />
}
