import { distanceCategory, STRATEGIES, type Strategy } from '@racer/domain'
import { m } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../ui/BottomSheet'
import { GameButton } from '../ui/GameButton'
import { DEMO_RACES, GRADE_LABEL, STRATEGY_LABEL, type DemoRace } from './race/demoRaces'

const GRADE_STYLE: Record<string, string> = {
  g1: 'from-[#4f7cff] to-[#2a4fd6]',
  g2: 'from-[#ff6f91] to-[#d63a63]',
  g3: 'from-[#3ecf8e] to-[#1f9a64]',
  debut: 'from-[#9aa7b8] to-[#6b7a8f]',
}

export function RaceSelectScreen() {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<DemoRace | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('pace')

  const start = () => {
    if (!picked) return
    const seed = Math.floor(Math.random() * 2 ** 31)
    navigate(`/race/run?race=${picked.id}&strategy=${strategy}&seed=${seed}`)
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <h1 className="px-1 text-2xl font-extrabold text-white text-outline">Choose a race</h1>
      {DEMO_RACES.map((race, i) => (
        <m.button
          key={race.id}
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setPicked(race)}
          className="flex items-center gap-3 rounded-[var(--radius-panel)] border-2 border-white bg-white/95 p-3 text-left shadow-[var(--shadow-panel)]"
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-sm font-extrabold text-white text-outline ${GRADE_STYLE[race.grade] ?? GRADE_STYLE.debut}`}
          >
            {GRADE_LABEL[race.grade]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-extrabold">{race.name}</span>
            <span className="block text-sm text-ink-soft">
              {race.venue} · {race.surface === 'turf' ? 'Turf' : 'Dirt'} {race.distance}m ·{' '}
              <span className="capitalize">{distanceCategory(race.distance)}</span>
            </span>
          </span>
          <span className="text-2xl" aria-hidden>
            ›
          </span>
        </m.button>
      ))}

      <BottomSheet open={picked !== null} onClose={() => setPicked(null)}>
        {picked && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-extrabold tracking-wider text-ink-soft uppercase">{GRADE_LABEL[picked.grade]}</p>
              <p className="text-2xl font-extrabold">{picked.name}</p>
              <p className="text-sm text-ink-soft">
                {picked.venue} · {picked.distance}m · {picked.fieldSize} runners
              </p>
            </div>
            <div>
              <p className="mb-2 font-extrabold">Strategy</p>
              <div className="grid grid-cols-2 gap-2">
                {STRATEGIES.map((s) => (
                  <m.button
                    key={s}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStrategy(s)}
                    className={`min-h-12 rounded-xl border-2 px-3 font-extrabold ${
                      strategy === s ? 'border-sky bg-sky text-white text-outline' : 'border-white bg-white text-ink'
                    }`}
                  >
                    {STRATEGY_LABEL[s]}
                  </m.button>
                ))}
              </div>
            </div>
            <GameButton variant="go" size="lg" onClick={start}>
              Start race
            </GameButton>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
