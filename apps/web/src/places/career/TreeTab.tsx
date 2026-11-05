// Upgrade's Tree (D387): her five branches as columns, each its twenty pips in five levels (level 5 on top), what she
// has bought filled in its stat's colour and the next pip ringed. A column is a 44 pt button that selects its branch;
// the branch preselected is the one whose next pip she can afford with the most drills. Below, the selected branch's
// next pip and its open level's row show their exact gain (each stat and SP), any part her caps throw away, and their
// cost before **Buy pip** or **Buy row** (`buy-pips`); once a branch reaches level 3, the Camps preview the same way.
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import { campsOpen, previewCamp, previewPip, previewPips, rowLeft, type BuildView, type TreePreview } from '@racer/domain/build'
import { BRANCHES, PIPS_PER_BRANCH, type Branch, type CareerRecord } from '@racer/domain/save'
import { useState } from 'react'
import { STAT_LABEL } from '../../ui/labels'
import { TypeIcon } from '../../ui/TypeIcon'
import { careersWords } from './model'
import { useCareerOp } from './useCareerOp'
import { GainChips } from './Wallet'

const FILL: Readonly<Record<Branch, string>> = {
  speed: 'bg-stat-speed', stamina: 'bg-stat-stamina', power: 'bg-stat-power', guts: 'bg-stat-guts', wit: 'bg-stat-wit',
}
const LEVELS = [5, 4, 3, 2, 1] as const
const PIPS_PER_LEVEL = 4

/** The branch selected first: an affordable next pip with the most drills behind it, else the most drills. */
export function preselectBranch(career: CareerRecord, view: BuildView): Branch {
  const ranked = [...BRANCHES].sort((a, b) => career.wallet.drills[b] - career.wallet.drills[a])
  return ranked.find((branch) => {
    const pip = previewPip(career, view, branch)
    return pip !== null && pip.cost <= career.wallet.drills[branch]
  }) ?? ranked.find((branch) => career.pips[branch] < PIPS_PER_BRANCH) ?? BRANCHES[0]!
}

function Column({ branch, career, view, selected, onSelect }: { branch: Branch; career: CareerRecord; view: BuildView; selected: boolean; onSelect: () => void }) {
  const pips = career.pips[branch]
  const next = previewPip(career, view, branch)
  const affordable = next !== null && next.cost <= career.wallet.drills[branch]
  const level = next?.level ?? 5
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} data-branch={branch} data-pips={pips}
      aria-label={`${careersWords('branch-line', { branch: STAT_LABEL[branch], level, pips, of: PIPS_PER_BRANCH })}${affordable ? `, ${careersWords('affordable')}` : ''}`}
      className={`flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-md border px-1 py-1.5 ${selected ? 'border-accent bg-accent-wash ring-2 ring-inset ring-accent' : 'border-hairline bg-panel'}`}>
      <span aria-hidden className="relative">
        <TypeIcon type={branch} size={24} />
        {affordable && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border border-panel bg-success" data-affordable />}
      </span>
      <span aria-hidden className="flex flex-col gap-1">
        {LEVELS.map((at) => (
          <span key={at} className="flex gap-0.5">
            {Array.from({ length: PIPS_PER_LEVEL }, (_, i) => {
              const index = (at - 1) * PIPS_PER_LEVEL + i
              const tone = index < pips ? FILL[branch] : index === pips ? 'bg-panel ring-2 ring-accent' : 'bg-sunken'
              return <span key={i} className={`size-2.5 rounded-full ${tone}`} />
            })}
          </span>
        ))}
      </span>
      <span aria-hidden className="numeral text-[11px] font-semibold text-ink-soft">{pips}/{PIPS_PER_BRANCH}</span>
    </button>
  )
}

/** A buy line: its name, its gain and overflow, and its button with the cost. */
function BuyLine({ title, preview, have, branch, action, disabled, onBuy, racer }: {
  title: string; preview: TreePreview; have: number; branch: Branch; action: string; disabled: boolean; onBuy: () => void; racer: string
}) {
  const short = preview.cost - have
  return (
    <div className="space-y-1.5 rounded-sm bg-sunken/60 p-2" data-racer={racer} data-cost={preview.cost}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="numeral flex items-center gap-1 text-[13px] font-semibold" aria-label={careersWords('cost', { n: preview.cost })}>
          <TypeIcon type={branch} size={16} />{preview.cost}
        </span>
      </div>
      <GainChips gain={preview.gain} overflow={preview.overflow} label={title} />
      <Button size="sm" className="w-full" disabled={disabled || short > 0} onClick={onBuy}>
        {short > 0 ? careersWords('needs-drills', { n: short, branch: STAT_LABEL[branch] }) : `${action} · ${careersWords('cost', { n: preview.cost })}`}
      </Button>
    </div>
  )
}

export function TreeTab({ careerId, career, view }: { careerId: string; career: CareerRecord; view: BuildView }) {
  const [selected, setSelected] = useState<Branch>(() => preselectBranch(career, view))
  const op = useCareerOp()
  const pips = career.pips[selected]
  const have = career.wallet.drills[selected]
  const pip = previewPip(career, view, selected)
  const left = rowLeft(pips)
  const row = left > 1 ? previewPips(career, view, selected, left) : null
  const open = campsOpen(career)
  const camp = open ? previewCamp(career, view, selected) : null
  const slot = career.camps.indexOf(null)
  return (
    <div className="space-y-3" data-racer="tree-tab">
      <div role="group" aria-label={careersWords('tab-tree')} className="grid grid-cols-5 gap-1.5">
        {BRANCHES.map((branch) => (
          <Column key={branch} branch={branch} career={career} view={view} selected={branch === selected} onSelect={() => setSelected(branch)} />
        ))}
      </div>
      <Panel className="space-y-2 p-3" data-racer="pip-preview" data-branch={selected}>
        <h3 className="flex items-center justify-between gap-2 font-display text-[15px] font-semibold">
          <span className="flex items-center gap-1.5"><TypeIcon type={selected} size={24} />{STAT_LABEL[selected]} · Lv {pip?.level ?? 5}</span>
          <span className="numeral text-[13px] text-ink-soft" aria-label={careersWords('drills', { stat: STAT_LABEL[selected] }) + ` ${have}`}>{have}</span>
        </h3>
        {pip === null ? (
          <p className="text-[13px] text-ink-soft">{careersWords('branch-full', { branch: STAT_LABEL[selected] })}</p>
        ) : (
          <>
            <BuyLine title={careersWords('next-pip')} preview={pip} have={have} branch={selected} action={careersWords('buy-pip')} racer="next-pip"
              disabled={op.busy} onBuy={() => void op.go('buy-pips', { careerId, branch: selected, count: 1 })} />
            {row !== null && (
              <BuyLine title={careersWords('row-pips', { n: left })} preview={row} have={have} branch={selected} action={careersWords('buy-row')} racer="row-pips"
                disabled={op.busy} onBuy={() => void op.go('buy-pips', { careerId, branch: selected, count: left })} />
            )}
          </>
        )}
        <section className="space-y-1.5 border-t border-hairline pt-2" aria-label={careersWords('camps')} data-racer="camps">
          <h4 className="flex items-center gap-2 text-micro">
            {careersWords('camps')}
            {career.camps.map((bought, i) => bought === null
              ? <span key={i} className="size-5 rounded-full border border-dashed border-hairline-strong" aria-label={`${careersWords('camp-slot', { n: i + 1 })}: open`} />
              : <span key={i} aria-label={`${careersWords('camp-slot', { n: i + 1 })}: ${STAT_LABEL[bought]}`}><TypeIcon type={bought} size={20} /></span>)}
          </h4>
          {!open ? <p className="text-[12px] text-ink-soft">{careersWords('camps-closed')}</p>
            : slot < 0 || camp === null ? <p className="text-[12px] text-ink-soft">{careersWords('camps-full')}</p>
              : <BuyLine title={careersWords('camp-in', { branch: STAT_LABEL[selected] })} preview={camp} have={have} branch={selected} action={careersWords('buy-camp')} racer="camp"
                disabled={op.busy} onBuy={() => void op.go('buy-pips', { careerId, branch: selected, camp: true })} />}
        </section>
        {op.error !== null && <p role="alert" className="text-[13px] text-danger">{op.error}</p>}
      </Panel>
    </div>
  )
}
