import { TICKET_STORAGE_CAP } from '@racer/domain'
import { m } from 'motion/react'
import { useNavigate } from 'react-router'
import { useGame } from '../game/store'
import { GameButton } from '../ui/GameButton'
import { Meter } from '../ui/Meter'
import { Panel } from '../ui/Panel'

export function HomeScreen() {
  const navigate = useNavigate()
  const tickets = useGame((s) => s.profile.tickets)

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Featured Uma hero — portrait art arrives with the private content packs. */}
      <Panel className="relative overflow-hidden bg-gradient-to-b from-white to-[#e8f6ff] p-0">
        <div className="flex flex-col items-center px-4 pt-6 pb-5">
          <m.div
            className="relative flex h-44 w-44 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-sky-top to-sky shadow-[var(--shadow-panel)]"
            animate={{ scale: [1, 1.025, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-7xl" aria-hidden>
              🐎
            </span>
            <span className="absolute -right-1 bottom-3 rounded-full border-2 border-white bg-gold px-2.5 py-0.5 text-sm font-extrabold text-white text-outline">
              Lv 1
            </span>
          </m.div>
          <p className="mt-4 text-xl font-extrabold">Your stable awaits</p>
          <p className="text-sm text-ink-soft">URA Finale · Training Level 1</p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t-2 border-white bg-white/60 p-4">
          <GameButton variant="secondary" size="lg" disabled>
            Train
          </GameButton>
          <GameButton variant="go" size="lg" onClick={() => navigate('/race')}>
            Race!
          </GameButton>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <p className="font-extrabold">🎫 Training tickets</p>
          <p className="text-sm font-extrabold text-ink-soft">
            {tickets} / {TICKET_STORAGE_CAP}
          </p>
        </div>
        <div className="mt-2">
          <Meter value={tickets / TICKET_STORAGE_CAP} color="linear-gradient(90deg,#ffd65a,#f2b807)" height={12} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">+50 every day · level-ups add more · spend on training, promotions, limit breaks</p>
      </Panel>

      <Panel className="bg-gradient-to-br from-[#fff4d6] to-white">
        <p className="font-extrabold">🏁 Race engine preview</p>
        <p className="mt-1 text-sm text-ink-soft">
          The R1 race engine is live: real phases, stamina, and last-spurt decisions, played back in real time. Pick any
          race from the Race tab.
        </p>
      </Panel>
    </div>
  )
}
