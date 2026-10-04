// DEV-only invented bank and receipt projection. No account reads/writes or original content.
import { createInspirationBank, openBankOutfit, repayInspiration } from '@racer/domain'
import { InspirationBankPanel } from '../../ui/InspirationBankPanel'
import { RpgInspirationReward } from '../../ui/rpg/RpgInspirationReward'
let bank = createInspirationBank(Array.from({ length: 8 }, (_, i) => ({ id: `invented-worker-${i}`, scenarios: [{ tier: 1, inspiration: { slots: [], golds: [] } }] })), 1)
for (const id of Object.keys(bank.cohort)) bank = openBankOutfit(bank, id)
bank = repayInspiration(bank, 'inspiration:t1:skill', 60).bank!
const skill = repayInspiration(bank, 'inspiration:t1:skill', 60)
const slot = repayInspiration(skill.bank, 'inspiration:t1:slot', 30)
export function InspirationAdvanceProofScreen() {
  return <main className="h-dvh overflow-y-auto bg-page px-4 pt-safe pb-safe text-ink"><header className="py-4"><p className="text-micro">Invented read-only phone proof</p><h1 className="font-display text-2xl">Inspiration tokens</h1></header>
    <InspirationBankPanel tier={1} preview={slot.bank!} />
    <div className="rounded-md bg-stage p-3 text-ink-on-dark"><RpgInspirationReward reward={{ tier: 1, slot: 30, skill: 60 }} repaid={{ slot: slot.debtPaid, skill: skill.debtPaid }} label="Earned this attempt · acknowledged rewards" /></div>
    <p className="my-4 text-xs leading-5 text-ink-soft">Eight invented outfits received six slots and twelve gold positions each. The first 60 Skill tokens repaid debt; this later award deposits 24 Skill tokens and keeps the remaining Slot debt.</p>
  </main>
}
