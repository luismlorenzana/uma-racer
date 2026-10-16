// Her bonds and card set at the Dojo, in the shell (docs/game/06-cards-and-bonds.md §2, §3, §6; D129; T139): her
// bonds this tier against the pacing count, the viewed preset's six slots (each card's nodes and pay, dimmed with
// "Newer cards available" once its era falls behind), each slot opening T138's Card Library in pick mode on her bonded
// cards (`set-card-set`, its refusals in words, its hand-over in one line), and **Bond more**: the Library on the cards
// she can bond now, a pick going to the Dojo's session sheet with her, the card and its room.
import { Sheet } from '@luismlorenzana/uma-kit/ui'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { TypeIcon } from '../../../ui/TypeIcon'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap } from '../../../ui/work/useTap'
import { cardName } from '../../../ui/words'
import { CardLibrary } from '../../card-library/CardLibrary'
import { bondSessionPath } from '../../card-library/model'
import { BuildFrame, type BuildContext } from '../BuildFrame'
import type { BuildViewProps } from '../Page'
import { trainingWords } from '../words'
import { bondable, dojoView, receiptLine, setWith } from './model'
import { DISTANCE_LABEL } from '../../../ui/labels'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[13px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

function Bonds({ build }: { build: BuildContext }) {
  const tap = useTap()
  const navigate = useNavigate()
  const [slot, setSlot] = useState<number | null>(null)
  const [bonding, setBonding] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const { uma, preset, settled, content, here } = build
  const model = useMemo(() => dojoView(uma, preset, content), [uma, preset, content])
  const bonded = useMemo(() => {
    const ids = new Set(uma.build.bonds)
    return (cardId: string) => ids.has(cardId)
  }, [uma])
  const canBond = useMemo(() => bondable(settled, uma, content), [settled, uma, content])
  const name = build.context.umaName(uma.outfitId) || uma.outfitId
  const current = uma.build.presets[preset].cardSetIds

  const put = (index: number, cardId: string | null) => {
    setSlot(null)
    void tap.run('set-card-set', { umaId: uma.outfitId, preset, cardSetIds: setWith(current, index, cardId) }, `set:${uma.outfitId}`).then((answer) => {
      setLine(answer?.kind === 'done' ? receiptLine(answer.receipt, content) : null)
    })
  }

  return (
    <div className="space-y-3 px-4 py-3" data-g2="dojo-view">
      <section aria-labelledby="dojo-bonds" className="space-y-1.5">
        <h2 id="dojo-bonds" className="text-micro">{trainingWords('bonded-title')}</h2>
        <p className="text-[14px] font-semibold" data-g2="bonds-line">{model.line}</p>
        {model.bonds.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {model.bonds.map((cardId) => {
              const card = content.cards.get(cardId)
              return (
                <li key={cardId} className="flex items-center gap-1 rounded-full border border-hairline bg-sunken/60 py-0.5 pr-2 pl-1 text-[12px]">
                  {card !== undefined && <TypeIcon type={card.type} size={16} />}
                  <span className="max-w-[12rem] truncate">{cardName(content, cardId)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="dojo-set" className="space-y-1.5">
        <h2 id="dojo-set" className="text-micro">{trainingWords('set-title', { preset: DISTANCE_LABEL[preset] })}</h2>
        <ol className="space-y-1.5">
          {model.set.map((entry) => (
            <li key={entry.index} data-set-slot={entry.index + 1} className="flex items-center gap-2 rounded-sm border border-hairline bg-panel p-2">
              <button
                type="button"
                onClick={() => setSlot(entry.index)}
                aria-label={entry.cardId === null ? trainingWords('set-pick', { n: entry.index + 1 }) : `${trainingWords('set-slot', { n: entry.index + 1 })}, ${entry.name}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
              >
                {entry.type !== null ? <TypeIcon type={entry.type} size={20} /> : <span aria-hidden className="size-5 rounded-xs border border-dashed border-hairline-strong" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{entry.name ?? trainingWords('set-empty')}</span>
                  {entry.cardId !== null && (
                    <span className={`block text-[12px] ${entry.older ? 'text-ink-faint' : 'text-ink-soft'}`}>
                      {entry.pay === null ? null : trainingWords(entry.nodes === 1 ? 'set-nodes-one' : 'set-nodes', { n: entry.nodes, pay: entry.pay })}
                      {entry.older && <span className="ml-1 font-semibold text-ink-soft" data-g2="newer-cards">· {trainingWords('newer-cards')}</span>}
                    </span>
                  )}
                </span>
              </button>
              {entry.cardId !== null && (
                <button type="button" disabled={tap.pending !== null} onClick={() => put(entry.index, null)}
                  aria-label={trainingWords('set-remove', { card: entry.name ?? '' })}
                  className={`${BUTTON} border border-hairline-strong bg-panel text-ink-soft`}>
                  {trainingWords('remove')}
                </button>
              )}
            </li>
          ))}
        </ol>
        {line !== null && <p role="status" className="text-[13px] text-ink" data-g2="set-receipt">{line}</p>}
        <TapNoteLine tap={tap} />
      </section>

      <section aria-labelledby="dojo-more" className="space-y-1.5">
        <h2 id="dojo-more" className="text-micro">{trainingWords('bond-more')}</h2>
        <p className="text-[13px] text-ink-soft">{trainingWords('bond-more-hint')}</p>
        <button type="button" onClick={() => setBonding(true)} data-action="bond-more" className={`${BUTTON} w-full bg-accent text-ink`}>
          {trainingWords('bond-more')}
        </button>
      </section>

      <Sheet open={slot !== null} onClose={() => setSlot(null)} label={slot === null ? undefined : trainingWords('set-pick', { n: slot + 1 })}>
        {slot !== null && (
          <CardLibrary mode="pick" umaId={uma.outfitId} preset={preset} title={trainingWords('set-pick', { n: slot + 1 })} eligible={bonded} onPick={(cardId) => put(slot, cardId)} />
        )}
      </Sheet>
      <Sheet open={bonding} onClose={() => setBonding(false)} label={trainingWords('pick-card-title', { uma: name })}>
        {bonding && (
          <CardLibrary
            mode="pick"
            umaId={uma.outfitId}
            title={trainingWords('pick-card-title', { uma: name })}
            eligible={canBond}
            onPick={(cardId) => {
              const card = content.cards.get(cardId)
              setBonding(false)
              if (card !== undefined) navigate(bondSessionPath(uma.outfitId, card, here), { state: { back: true } })
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

export default function BondsView({ place, umaId }: BuildViewProps) {
  return (
    <BuildFrame place={place} umaId={umaId} title={(name) => trainingWords('dojo-title', { uma: name })}>
      {(build) => <Bonds build={build} />}
    </BuildFrame>
  )
}
