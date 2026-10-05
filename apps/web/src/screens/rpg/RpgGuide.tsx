// Contextual campaign guide (docs/design/uma-rpg.md#phone-presentation); read-only, no host calls.
import { RPG_B_MAX_DEPTH, RPG_CLASS_EDIT_MAX_LEVEL, RPG_DEPTH_GATES, RPG_MAX_LEGACY_SLOTS, RPG_PARTY_SIZE, RPG_PRESET_COUNT,
  RPG_SIGNATURE_MULTIPLIER, RPG_SKILL_MAX_LEVEL, RPG_SLOT_TOKEN_REWARD, RPG_SKILL_TOKEN_BUDGET, RPG_TIER_MAX_LEVEL,
  type RpgWeapon } from '@racer/domain'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { IdentityGlyph, RPG_WEAPON_LABELS } from '../../ui/rpg/RpgPortrait'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'
import { createGuideMemory } from '../../ui/minigames/guide-memory'

export const rpgGuideMemory = createGuideMemory('uma-racer:rpg-guide-v1')
export type RpgGuidePage = 'party' | 'class' | 'turn' | 'channels' | 'elements' | 'support' | 'save' | 'progression' | 'tokens'
export interface RpgGuideProps {
  onClose: () => void; startAt?: RpgGuidePage; finishLabel?: string; proof?: boolean
  reduced?: boolean; setReduced?: (value: boolean) => void; onAbandon?: () => void; canAbandon?: boolean
}
export function RpgGuide({ onClose, startAt = 'party', finishLabel = 'Back to RPG', proof: developmentProof = false,
  reduced = false, setReduced, onAbandon, canAbandon = false }: RpgGuideProps) {
  const proof = import.meta.env.DEV && developmentProof
  const weapons: RpgWeapon[] = ['greatsword', 'spear', 'sword-shield', 'wizard-staff', 'cleric-staff', 'tome']
  const pages: PagedGuidePage<RpgGuidePage>[] = [
    { id: 'party', title: 'Build your adventure party', body: <>
      <div className="grid grid-cols-5 gap-1" aria-label={`${RPG_PARTY_SIZE} required party slots`}>{Array.from({ length: RPG_PARTY_SIZE }, (_, i) => <div key={i} className="rounded-sm border border-hairline-dark bg-stage-soft p-2 text-center"><span className="block text-lg text-accent">{i + 1}</span><span className="text-[10px]">Outfit</span></div>)}</div>
      <p>{RPG_PRESET_COUNT} presets share outfit RPG levels. Enroll owned outfits, fill all {RPG_PARTY_SIZE} slots with distinct outfits and save. Front and End are recommended, never required.</p>
      <p>Choose any published chapter. Enemy teams, paths and level recommendations are visible before entry. Entry and retry are free; Racing, Training and Farm progression are separate.</p>
    </> },
    { id: 'class', title: 'A permanent class, flexible elements', body: <>
      <div className="grid grid-cols-2 gap-2">{weapons.map(weapon => <div key={weapon} className="flex items-center gap-2 rounded-sm border border-hairline-dark bg-stage-soft p-2 text-xs"><IdentityGlyph weapon={weapon} />{RPG_WEAPON_LABELS[weapon]}</div>)}</div>
      <p>Choose an A running style: Front → Greatsword; Pace → Spear or Sword + shield; Late → Wizard or Cleric staff; End → Magic tome. The outfit profile's Edit class is free while Tier 1, RPG Lv{RPG_CLASS_EDIT_MAX_LEVEL} and outside open battles. From Lv{RPG_CLASS_EDIT_MAX_LEVEL + 1}, style and weapon stay locked, including after promotion.</p>
      <p>Distance A/B gives elements: Sprint → Dark/Light; Mile → Ice/Light; Medium → Fire/Dark; Long → Lightning/Light. A permits all depths; B stops at depth {RPG_B_MAX_DEPTH} in the same weapon tree. Turf/Dirt does not gate skills.</p>
      <p>A party slot chooses any eligible signature. Matching techniques gain {Math.round((RPG_SIGNATURE_MULTIPLIER - 1) * 100)}% damage/healing; other eligible elements can still be equipped. Portrait overlays show weapon and signature.</p>
    </> },
    { id: 'turn', title: 'Five outfits, one team', body: <>
      <p>Choose a ready outfit, Attack / Skill / Guard, then a legal target. Review the projected effect and confirm. Each living outfit acts once; the final action also resolves the enemy intents.</p>
      <p className="rounded-md border border-hairline-dark bg-stage-soft p-3 text-sm">HP and MP sit beside each portrait. Skills spend their shown MP once. Attack and Guard are free and outside equipped skill slots.</p>
      {setReduced && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={reduced} onChange={event => setReduced(event.target.checked)} />Reduced motion / immediate cues</label>}
    </> },
    { id: 'channels', title: 'Physical or magical', body: <>
      <p>Greatsword, spear and sword + shield use physical damage. Staves and tomes use magical damage. Speed drives ATK and MATK from frozen base racing stats, not your current Training build.</p>
      <p>Physical skills add an elemental rider; only that rider uses the matchup. Magical skills apply the matchup to their full damage. Details shows the exact engine projection, including retaliation after the last outfit acts.</p>
    </> },
    { id: 'elements', title: 'Find the weakness', body: <>
      <div className="space-y-2 rounded-md border border-hairline-dark bg-stage-soft p-4">{(['fire', 'ice', 'lightning'] as const).map((element, i) => <p key={element} className="flex items-center gap-2"><IdentityGlyph element={element} />{['Fire beats Ice', 'Ice beats Lightning', 'Lightning beats Fire'][i]}</p>)}</div>
      <p>Light and Dark beat each other and are neutral to the triangle. The preview says Weakness, Resistance or Neutral; color is never the only clue. A weak hit can trigger one automatic follow-up per round, not an extra selectable turn.</p>
    </> },
    { id: 'support', title: 'Plan, guard and heal', body: <>
      <p>Plans shows each enemy's next action, channel, element and target. Boss phases reveal new intents before resolution.</p>
      <p>Guard intercepts a hit for the selected living ally. Healing/support also target living allies; KO outfits cannot act or be revived. Paladin and Cleric offer healing and buffs. Skills show MP, target and statuses before confirmation.</p>
      <p>Every encounter starts at full HP/MP. Recovery nodes are safe setup stops and shorter routes, not persistent healing. Battle Items are not implemented.</p>
    </> },
    { id: 'save', title: 'Checkpoints, retries and devices', body: <>
      <p>Back, background or refresh keeps the exact saved turn on this device. Skip changes animation only. A second device explicitly takes over and restarts the same frozen fight; the old device becomes stale. Missing journals require same-seed restart, never a reroll.</p>
      <p>Offline actions remain playable. Pending entry/results are not yet earned: EXP, Items and the next map node wait for account acknowledgement. Accept a won fight on the map to collect tokens.</p>
      <p>Switching chapters explicitly forfeits unresolved actions, keeping earlier clears and the same fight for free retry. Only voluntary replay after clear creates a new attempt. Each preset remembers its chapters independently.</p>
      {proof && <p>This development proof never awards account progress.</p>}
      {onAbandon && <button disabled={!canAbandon} className="min-h-11 rounded-sm border border-hairline-dark p-3 text-sm disabled:opacity-40" onClick={onAbandon}>Abandon to checkpoint · no rewards</button>}
    </> },
    { id: 'progression', title: 'Levels, skills and promotion', body: <>
      <p>Accepted wins pay RPG EXP to all five entrants, including KO members. Loss and abandon pay none. Low levels catch up; stronger outfits earn less from weak chapters. Results show exact stat gains, crossed levels and new choices.</p>
      <div className="rounded-md border border-hairline-dark bg-stage-soft p-3 text-sm">Tree depths open at Lv{RPG_DEPTH_GATES.join(' / ')}. Even levels earn a point; each node or skill-level improvement costs one. Skills reach level {RPG_SKILL_MAX_LEVEL}.</div>
      <p>At accepted safe checkpoints, open an outfit profile to spend points and equip learned techniques. Open or pending fights block setup changes; their party stays frozen.</p>
      <p>Lv{RPG_TIER_MAX_LEVEL} banks EXP until manual promotion. Keep stats and bank, archive the old tree, choose up to {RPG_MAX_LEGACY_SLOTS} legacy techniques and begin a fresh tier. Unspent points need explicit discard. Class and weapon do not reset.</p>
    </> },
    { id: 'tokens', title: 'Rewards fund Inspiration', body: <>
      <div className="grid grid-cols-2 gap-2">{(['slot', 'skill'] as const).map(kind => <div key={kind} className="flex items-center gap-2 rounded-sm border border-hairline-dark bg-stage-soft p-3 text-sm"><InspirationTokenIcon kind={kind} /><span>{kind === 'slot' ? `${RPG_SLOT_TOKEN_REWARD} Slot · boss` : `At least ${RPG_SKILL_TOKEN_BUDGET} Skill · shortest route`}</span></div>)}</div>
      <p>Regular/elite wins collect Skill Tokens on map acceptance; boss clears collect Slot Tokens. Global Items names the scenario. One Slot Token opens one parent/grandparent; one Skill Token opens one natural-gold position. Inherited Unique comes with its slot.</p>
      <p>Your Inspiration advance repays matching scenario/type debt first. Rewards show gross, repaid and deposited. Existing inventory stays spendable. All distance presets share scenario unlocks and debt.</p>
      <p>Select two distinct parents. A grandparent's Unique and golds cost double SP unless that exact outfit mirrors across opposite sides; a cheaper own/card/parent source still wins. Assignment and SP choices stay in Training → Inspiration / Skills.</p>
    </> },
  ]
  return <RpgModalFocus onClose={onClose}><PagedGuide open pages={pages} startAt={startAt} titleId="rpg-campaign-guide" finishLabel={finishLabel} onClose={onClose} /></RpgModalFocus>
}
