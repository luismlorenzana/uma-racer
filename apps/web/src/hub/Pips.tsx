// Slot pips (docs/game/11-hub-and-places.md §4): up to eight 20 pt pips in two rows of four under a building's name
// pill, display only (the place link is the target, and VoiceOver reads its line). Busy: her face in a ring filled by the
// current item's progress, with "+N" on its shoulder for requests queued behind. Ready: the ring full and gold with a
// small bounce (none with reduced motion). Free: a hollow ring. The Gym's and Dojo's rings take their room's stat or
// card-type colour. Past eight slots the eighth pip is "+N".
import type { HubBuilding, HubPip } from '@racer/domain/hub'
import type { RoomId } from '@racer/domain/farm'
import { UmaFace } from '../ui/UmaArt'

const ROOM_TONE: Readonly<Record<RoomId, string>> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
  'friend-group': 'var(--g2-room-friend)',
}

const BUSY_TONE = 'var(--color-ink-soft)'
const TRACK = 'var(--color-hairline-strong)'

function Pip({ pip }: { pip: HubPip }) {
  const tone = pip.room === null ? null : ROOM_TONE[pip.room]
  const common = { 'data-pip': pip.state, 'data-outfit': pip.outfitId ?? undefined, 'data-room': pip.room ?? undefined }
  if (pip.state === 'free') {
    return <span {...common} className="block size-5 rounded-full border-2 border-ink-faint/50" style={tone === null ? undefined : { borderColor: tone }} />
  }
  const ready = pip.state === 'ready'
  const ring = ready ? 'var(--color-accent)' : `conic-gradient(${tone ?? BUSY_TONE} ${Math.round(pip.progress * 360)}deg, ${TRACK} 0)`
  return (
    <span {...common} data-queued={pip.queued || undefined} className={`relative block size-5 rounded-full p-[2px] ${ready ? 'g2-pip-ready' : ''}`} style={{ background: ring }}>
      <span className="block size-4 overflow-hidden rounded-full bg-panel">
        <UmaFace outfitId={pip.outfitId!} size={16} />
      </span>
      {pip.queued > 0 && (
        <span className="font-display absolute -top-1.5 -right-2 rounded-full bg-ink px-1 text-[9px] leading-3 font-bold text-ink-on-dark">+{pip.queued}</span>
      )}
    </span>
  )
}

export function Pips({ building }: { building: HubBuilding }) {
  // Four to a row, and no wider than the pips it holds, so its backing on the map fits them.
  const columns = Math.min(4, building.pips.length + (building.more > 0 ? 1 : 0))
  return (
    <span aria-hidden data-pips className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1.25rem)` }}>
      {building.pips.map((pip, i) => <Pip key={i} pip={pip} />)}
      {building.more > 0 && (
        <span data-pip="more" className="font-display flex size-5 items-center justify-center rounded-full bg-sunken text-[9px] font-bold text-ink-soft">
          +{building.more}
        </span>
      )}
    </span>
  )
}
