// Full Rival Circuit guide, sharing Friendship Training's paged model (D178).
import {
  SPARK_MATCH_TICKET_COST,
  SPARK_RIVAL_BOARD_HEIGHT,
  SPARK_RIVAL_BOARD_WIDTH,
  SPARK_RIVAL_LOSS_EXP_SHARE,
  SPARK_RIVAL_MAX_DRIVE,
  SPARK_RIVAL_MOVEMENT_MS,
  SPARK_RIVAL_SHIFT_CHARGE,
  SPARK_RIVAL_TURNS_PER_WAVE,
  SPARK_RIVAL_WAVE_EXP,
  type Strategy,
} from '@racer/domain'
import type { ReactNode } from 'react'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import {
  SparkIcon,
  StaminaIcon,
  StrategyEndIcon,
  StrategyFrontIcon,
  StrategyLateIcon,
  StrategyPaceIcon,
  TrainingLevelIcon,
} from '../../ui/icons'
import { SparkRivalChibi } from '../../ui/minigames/SparkRivalChibi'
import { SPARK_ORB_COLORS, SPARK_STRATEGY_LABELS } from '../../ui/minigames/spark-rival-presentation'

export type SparkRivalGuidePageId = 'circuit' | 'drag' | 'matches' | 'advantage' | 'spark' | 'intent' | 'rewards'

const GUIDE_SEEN_KEY = 'uma-racer:spark-rival-guide-seen'

export function sparkRivalGuideSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(GUIDE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberSparkRivalGuideSeen(): void {
  try {
    globalThis.localStorage?.setItem(GUIDE_SEEN_KEY, '1')
  } catch {
    // A blocked store only means the free guide opens again next visit.
  }
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="rounded-md border border-hairline-dark bg-stage-soft p-3">{children}</div>
)

const Bullets = ({ items }: { items: readonly ReactNode[] }) => (
  <ul className="grid gap-2 text-[14px] leading-snug">
    {items.map((item, index) => (
      <li key={index} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden /><span>{item}</span></li>
    ))}
  </ul>
)

const STRATEGY_ICONS = {
  front: StrategyFrontIcon,
  pace: StrategyPaceIcon,
  late: StrategyLateIcon,
  end: StrategyEndIcon,
} as const

const ADVANTAGE_RING: readonly Strategy[] = ['pace', 'front', 'end', 'late']

/** The same complete text legend used by the guide page and the live Matchups shortcut. */
export function SparkAdvantageLegend() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-1" aria-label="Pace beats Front, Front beats End, End beats Late, Late beats Pace">
        {ADVANTAGE_RING.map((strategy, index) => {
          const Icon = STRATEGY_ICONS[strategy]
          return (
            <div key={strategy} className="relative grid justify-items-center gap-1 rounded-sm border bg-black/15 px-1 py-2" style={{ borderColor: SPARK_ORB_COLORS[strategy] }}>
              <Icon size={24} style={{ color: SPARK_ORB_COLORS[strategy] }} />
              <span className="text-[11px] font-semibold">{SPARK_STRATEGY_LABELS[strategy].split(' ')[0]}</span>
              {index < ADVANTAGE_RING.length - 1 && <span className="absolute top-3 -right-2.5 z-10 text-sm text-accent" aria-hidden>→</span>}
            </div>
          )
        })}
      </div>
      <p className="text-center text-[13px] font-semibold text-accent">Pace → Front → End → Late → Pace</p>
      <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
        <p className="rounded-sm bg-success/15 px-1 py-2"><strong className="block text-success">Advantage</strong>×1.5</p>
        <p className="rounded-sm bg-white/5 px-1 py-2"><strong className="block">Opposite</strong>neutral</p>
        <p className="rounded-sm bg-danger/15 px-1 py-2"><strong className="block text-danger">Resisted</strong>×0.67</p>
      </div>
    </div>
  )
}

function MiniBoard() {
  const kinds = ['front', 'pace', 'late', 'end', 'spark', 'recovery'] as const
  return (
    <div className="mx-auto grid w-full max-w-[270px] grid-cols-6 gap-1" aria-label="Six by five board preview">
      {Array.from({ length: SPARK_RIVAL_BOARD_WIDTH * SPARK_RIVAL_BOARD_HEIGHT }, (_, index) => {
        const kind = kinds[index % kinds.length]!
        return <SparkRivalChibi key={index} kind={kind} chibi={null} asset={null} label={kind} className="w-full" />
      })}
    </div>
  )
}

function guidePages(): readonly PagedGuidePage<SparkRivalGuidePageId>[] {
  const lossCap = Math.round(SPARK_RIVAL_LOSS_EXP_SHARE * 100)
  return [
    {
      id: 'circuit',
      title: 'Break three rivals’ Resolve',
      body: (
        <>
          <Panel>
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3].map((wave) => <span key={wave} className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-lg font-bold ${wave === 3 ? 'border-accent bg-accent/15 text-accent' : 'border-white/30 bg-white/5'}`}>{wave}</span>)}
            </div>
            <p className="mt-2 text-center text-xs text-ink-on-dark-soft">two training rivals · one circuit boss</p>
          </Panel>
          <Bullets items={[
            <>Empty each rival’s <strong>Resolve</strong> before pressure empties your {SPARK_RIVAL_MAX_DRIVE} <strong>Drive</strong>.</>,
            <>One circuit costs <strong>{SPARK_MATCH_TICKET_COST} Training Ticket</strong>. This guide and the start preview are always free.</>,
            <>The board and rivals are fixed by the run seed. Leaving pauses; returning restores the same action boundary.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'drag',
      title: 'Move one orb through the board',
      body: (
        <>
          <Panel><MiniBoard /></Panel>
          <Bullets items={[
            <>Press one Chibi orb, then drag through cells beside it—including diagonals. Every entered cell swaps with the held orb.</>,
            <>Plan as long as you like. The <strong>{SPARK_RIVAL_MOVEMENT_MS / 1_000}-second movement clock</strong> starts only after the first cell transition.</>,
            <>Reverse and revisit cells to shape several matches. Release—or reach the clock—to resolve one turn.</>,
            <>An interrupted or cancelled touch restores the board and costs no action.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'matches',
      title: 'Build matches and cascades',
      body: (
        <>
          <Panel>
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: 4 }, (_, index) => <SparkRivalChibi key={index} kind="pace" chibi={null} asset={null} label="Pace" className="w-12" />)}
            </div>
            <p className="mt-2 text-center font-display text-lg font-bold text-accent">4 orbs · stronger shape · 1 combo</p>
          </Panel>
          <Bullets items={[
            <>A horizontal or vertical line of <strong>three or more</strong> clears. Connected lines of the same kind are one combo.</>,
            <>All first matches clear together. New matches made by falling Chibis become cascades in the same turn.</>,
            <>More orbs strengthen that attack; more total combos multiply every attack and Recovery in the turn.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'advantage',
      title: 'Read the matchup ring',
      body: (
        <>
          <Panel><SparkAdvantageLegend /></Panel>
          <Bullets items={[
            <>Match the strategy that <strong>beats the rival’s current style</strong> for the strongest damage.</>,
            <>The rival’s ring, glyph and name show her style. A phase change updates all three before your next move.</>,
            <>Chibi art is identity; the thick ring, tint, glyph and this legend carry the rule. Colour is never the only clue.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'spark',
      title: 'Use Spark and Recovery',
      body: (
        <>
          <Panel>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="grid justify-items-center gap-1"><SparkRivalChibi kind="spark" chibi={null} asset={null} label="Spark" className="w-16" /><SparkIcon size={20} className="text-accent" /><p className="text-xs">charge {SPARK_RIVAL_SHIFT_CHARGE}</p></div>
              <div className="grid justify-items-center gap-1"><SparkRivalChibi kind="recovery" chibi={null} asset={null} label="Recovery" className="w-16" /><StaminaIcon size={20} className="text-success" /><p className="text-xs">restore Drive</p></div>
            </div>
          </Panel>
          <Bullets items={[
            <><strong>Spark</strong> deals neutral damage and fills Spark Shift. When ready, Shift changes every Spark on the board into your best strategy.</>,
            <><strong>Recovery</strong> restores Drive up to {SPARK_RIVAL_MAX_DRIVE}. Healing is applied after your attacks.</>,
            <>Spark Shift costs no turn, but the converted board resolves only after your next drag.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'intent',
      title: 'Read the rival before moving',
      body: (
        <>
          <Panel>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <SparkRivalChibi kind="late" chibi={null} asset={null} label="Rival" className="w-16" />
              <div><p className="font-semibold">Convert advantaged orbs</p><p className="text-xs text-ink-on-dark-soft">then Pressure</p></div>
              <span className="numeral rounded-full border border-accent px-3 py-1 text-xl text-accent">2</span>
            </div>
          </Panel>
          <Bullets items={[
            <>The countdown says how many player turns remain before the displayed intent fires.</>,
            <>Pressure removes Drive; Guard asks for combos; Convert changes orbs; Delay slows Shift. Enrage and style changes stay visible.</>,
            <>Defeat the rival before her action and she cannot take it. Each wave allows at most <strong>{SPARK_RIVAL_TURNS_PER_WAVE} drags</strong>.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'rewards',
      title: 'Every real result moves Training',
      body: (
        <>
          <Panel>
            <div className="flex items-center justify-center gap-3">
              <TrainingLevelIcon size={32} className="text-accent" />
              <div><p className="font-display text-2xl font-bold">Training EXP</p><p className="text-xs text-ink-on-dark-soft">{SPARK_RIVAL_WAVE_EXP.join(' + ')} by wave</p></div>
            </div>
          </Panel>
          <Bullets items={[
            <>A clear pays each wave’s budget plus clear, combo and remaining-Drive bonuses. A loss keeps only Resolve progress, with no bonuses and a {lossCap}% cap.</>,
            <>The result saves EXP once, carries surplus across Training Levels, and names every constellation node that opened.</>,
            <>Reloading or retrying the result cannot pay twice. Rival Circuit never grants Uma EXP, race wins, goals or race badges.</>,
          ]} />
        </>
      ),
    },
  ]
}

export function SparkRivalGuide({
  open,
  startAt = 'circuit',
  onClose,
}: {
  open: boolean
  startAt?: SparkRivalGuidePageId
  onClose: () => void
}) {
  return (
    <PagedGuide
      open={open}
      pages={guidePages()}
      startAt={startAt}
      titleId="spark-rival-guide-title"
      finishLabel="Let’s spar"
      onClose={onClose}
    />
  )
}
