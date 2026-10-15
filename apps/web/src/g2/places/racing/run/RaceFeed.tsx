// The race feed (D178), ported from today's `screens/race/RaceFeed.tsx` unchanged in behaviour: small toasts on the
// right of the course, newest on top, each a pure function of playback time. Faces are the new game's (`UmaFace`, her
// initial on the dev mount); names come from the race's content.
import type { RacePackCue, RaceCue } from '../../../../scenes/race/presentation'
import {
  ArrowDownIcon, ArrowUpIcon, BurstIcon, CrownIcon, GateIcon, MoveToIcon, WarningIcon, type IconComponent,
} from '../../../../ui/icons'
import { TypeIcon, type TypeIconKind } from '../../../../ui/TypeIcon'
import type { LoadedContent } from '../../../../content/runtime'
import { UmaFace } from '../../../ui/UmaArt'
import type { RaceRunner } from '../prepare'
import { effectLabel } from './labels'

/** A toast's height and the gap under it, in px. */
const ROW = 37

const PACK_TYPE: Partial<Record<RacePackCue, TypeIconKind>> = { 'Spot struggle': 'guts', 'Saving stamina': 'stamina' }

const PACK_ICON: Partial<Record<RacePackCue, IconComponent>> = {
  Blocked: WarningIcon,
  Overtaking: MoveToIcon,
  'Pace up': ArrowUpIcon,
  'Pace down': ArrowDownIcon,
  'Holding lead': CrownIcon,
  'Securing lead': CrownIcon,
  Repositioning: MoveToIcon,
}

type Tone = 'mine' | 'player' | 'rival' | 'alert'
const TONE: Record<Tone, { toast: string; badge: string; eyebrow: string }> = {
  mine: { toast: 'bg-accent text-ink', badge: 'bg-panel text-accent-strong', eyebrow: 'text-ink/75' },
  player: { toast: 'bg-panel/95 text-ink', badge: 'bg-accent-wash text-accent-strong', eyebrow: 'text-ink-soft' },
  rival: { toast: 'bg-ink/80 text-white', badge: 'bg-white/15 text-white', eyebrow: 'text-white/75' },
  alert: { toast: 'bg-danger text-white', badge: 'bg-white/20 text-white', eyebrow: 'text-white/80' },
}

interface ToastView {
  tone: Tone
  eyebrow: string
  title: string
  more: number
  face: string | null
  icon: IconComponent | null
  type?: TypeIconKind
}

function toastView(cue: RaceCue, seconds: number, content: LoadedContent, runners: readonly RaceRunner[]): ToastView {
  const more = cue.folded.filter((at) => at <= seconds).length
  const umaId = runners[cue.runner]?.templateId ?? null
  const name = (umaId && content.umas.byId.get(umaId)?.name) || 'A rival'
  const view = { more: 0, face: null, icon: null }
  if (cue.kind === 'skill') {
    const skill = (cue.skillId && content.skills.byId.get(cue.skillId)?.name) || cue.skillId || 'Skill'
    return cue.isPlayer
      ? { ...view, tone: 'mine', eyebrow: effectLabel(cue.skillEffects ?? []), title: skill, face: umaId }
      : { ...view, tone: 'rival', eyebrow: name, title: skill, more, face: umaId }
  }
  if (cue.kind === 'late-start') {
    return cue.isPlayer
      ? { ...view, tone: 'player', eyebrow: 'Start', title: 'Slow start', icon: GateIcon }
      : { ...view, tone: 'rival', eyebrow: 'Field start', title: `${more + 1} rival${more ? 's' : ''} started late`, icon: GateIcon }
  }
  if (cue.kind === 'spurt') {
    return cue.fullSpurt === false
      ? { ...view, tone: 'player', eyebrow: 'Stamina short', title: 'Held-back spurt', icon: BurstIcon }
      : { ...view, tone: 'mine', eyebrow: 'Final drive', title: 'Full spurt!', icon: BurstIcon }
  }
  if (cue.kind === 'hp-empty') return { ...view, tone: 'alert', eyebrow: 'Stamina', title: 'Out of HP', icon: WarningIcon }
  if (cue.kind === 'duel') return { ...view, tone: 'mine', eyebrow: 'Final straight', title: `Duel with ${name}`, face: umaId }
  const eyebrow = cue.packKind === 'Spot struggle' ? 'Early race'
    : cue.packKind === 'Securing lead' || cue.packKind === 'Repositioning' || cue.packKind === 'Saving stamina' ? 'Before the spurt'
      : 'Pack'
  return {
    ...view, tone: 'player', eyebrow, title: cue.packKind ?? 'Pack change',
    icon: cue.packKind ? PACK_ICON[cue.packKind] ?? null : null,
    ...(cue.packKind && PACK_TYPE[cue.packKind] ? { type: PACK_TYPE[cue.packKind] } : {}),
  }
}

export function RaceFeed({ cues, seconds, content, runners }: {
  cues: readonly RaceCue[]
  seconds: number
  content: LoadedContent
  runners: readonly RaceRunner[]
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-[22%] right-2 z-20 w-[min(50vw,11.5rem)]">
      {cues.map((cue, index) => {
        const view = toastView(cue, seconds, content, runners)
        const tone = TONE[view.tone]
        const leaving = seconds >= cue.endSeconds - (cue.endSeconds - cue.startSeconds) * 0.2
        const Icon = view.icon
        return (
          <div
            key={cue.id}
            className="absolute top-0 right-0 flex max-w-full justify-end transition-[transform,opacity] duration-200 ease-out"
            style={{ transform: `translateY(${index * ROW}px)`, opacity: leaving ? 0 : 1 }}
          >
            <div className={`race-toast-in flex h-8 max-w-full items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 shadow-2 ${tone.toast}`}>
              {view.face ? (
                <span className="shrink-0 rounded-full ring-2 ring-white/80"><UmaFace outfitId={view.face} size={24} /></span>
              ) : view.type ? (
                <TypeIcon type={view.type} size={24} />
              ) : (
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>{Icon && <Icon size={16} variant="solid" />}</span>
              )}
              <span className="min-w-0 leading-none">
                <span className={`block truncate pb-0.5 text-[10px] leading-3 font-bold ${tone.eyebrow}`}>{view.eyebrow}</span>
                <span className="block truncate text-xs leading-4 font-semibold">{view.title}</span>
              </span>
              {view.more > 0 && <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[11px] leading-4 font-bold tabular-nums">+{view.more}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
