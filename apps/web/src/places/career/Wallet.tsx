// A career's wallet as icons with numbers (D387): drills by colour, Bond and the SP she can spend, one row. The career
// page and the Upgrade screen draw it; each item reads its name and number to VoiceOver.
import { HeartIcon, SkillPointsIcon } from '@luismlorenzana/uma-kit/ui'
import type { Gain } from '@racer/domain/build'
import type { CareerWallet } from '@racer/domain/save'
import type { Stats } from '@racer/domain'
import { amount, STAT_KEYS, STAT_LABEL } from '../../ui/labels'
import { TypeIcon } from '../../ui/TypeIcon'
import { careersWords } from './model'

export function Wallet({ wallet, sp }: { wallet: CareerWallet; sp: number }) {
  return (
    <ul aria-label={careersWords('wallet')} data-racer="wallet" className="grid grid-cols-7 gap-0.5 rounded-md border border-hairline bg-panel px-1 py-1.5">
      {STAT_KEYS.map((stat) => (
        <li key={stat} className="flex flex-col items-center gap-0.5" aria-label={`${careersWords('drills', { stat: STAT_LABEL[stat] })} ${wallet.drills[stat]}`} data-drills={stat}>
          <TypeIcon type={stat} size={20} />
          <span aria-hidden className="numeral text-[13px] font-semibold">{amount(wallet.drills[stat])}</span>
        </li>
      ))}
      <li className="flex flex-col items-center gap-0.5" aria-label={`${careersWords('bond')} ${wallet.bond}`} data-wallet="bond">
        <HeartIcon size={20} variant="solid" className="text-stat-guts" />
        <span aria-hidden className="numeral text-[13px] font-semibold">{amount(wallet.bond)}</span>
      </li>
      <li className="flex flex-col items-center gap-0.5" aria-label={`${careersWords('sp')} ${sp}`} data-wallet="sp">
        <SkillPointsIcon size={20} variant="duotone" className="text-accent-strong" />
        <span aria-hidden className="numeral text-[13px] font-semibold">{amount(sp)}</span>
      </li>
    </ul>
  )
}

/** A gain as stat icons with "+n", and SP; what the caps throw away, in the warning ink. */
export function GainChips({ gain, overflow, label }: { gain: Gain; overflow?: Stats; label: string }) {
  const stats = STAT_KEYS.filter((stat) => gain.stats[stat] !== 0)
  const words = [
    ...stats.map((stat) => `${gain.stats[stat] > 0 ? '+' : ''}${gain.stats[stat]} ${STAT_LABEL[stat]}${(overflow?.[stat] ?? 0) > 0 ? ` (${overflow![stat]} over her cap)` : ''}`),
    ...(gain.sp === 0 ? [] : [`${gain.sp > 0 ? '+' : ''}${gain.sp} SP`]),
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`${label}: ${words.join(', ') || 'nothing'}`} data-racer="gain">
      {stats.map((stat) => (
        <li key={stat} aria-hidden className="flex items-center gap-0.5" data-gain={stat}>
          <TypeIcon type={stat} size={16} />
          <span className="numeral text-[13px] font-semibold">{gain.stats[stat] > 0 ? '+' : ''}{gain.stats[stat]}</span>
          {(overflow?.[stat] ?? 0) > 0 && <span className="numeral text-[11px] font-semibold text-warning" data-overflow={stat}>({overflow![stat]} over)</span>}
        </li>
      ))}
      {gain.sp !== 0 && (
        <li aria-hidden className="flex items-center gap-0.5" data-gain="sp">
          <SkillPointsIcon size={16} className="text-accent-strong" />
          <span className="numeral text-[13px] font-semibold">{gain.sp > 0 ? '+' : ''}{gain.sp}</span>
        </li>
      )}
    </ul>
  )
}
