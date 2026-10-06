// Campaign guide (docs/design/uma-rpg.md, D261–D263); read-only.
import { RPG_B_MAX_DEPTH, RPG_BATTLE_TOKENS, RPG_DEPTH_GATES, RPG_PARTY_SIZE, RPG_PRESET_COUNT, type RpgWeapon } from '@racer/domain'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { IdentityGlyph, RPG_WEAPON_LABELS } from '../../ui/rpg/RpgPortrait'
import { createGuideMemory } from '../../ui/minigames/guide-memory'

export const rpgGuideMemory = createGuideMemory('uma-racer:rpg-guide-v2')
export type RpgGuidePage = 'party' | 'class' | 'turn' | 'weakness' | 'bosses' | 'mp' | 'map'
export function RpgGuide({ onClose, startAt = 'party' }: { onClose: () => void; startAt?: RpgGuidePage }) {
  const weapons: RpgWeapon[] = ['greatsword', 'spear', 'sword-shield', 'wizard-staff', 'cleric-staff', 'tome']
  const card = 'rounded-md border border-hairline-dark bg-stage-soft p-3 text-sm'
  const pages: PagedGuidePage<RpgGuidePage>[] = [
    { id: 'party', title: 'Five Umas, one party', body: <>
      <p>Enroll owned Umas in the Roster, then fill a party's {RPG_PARTY_SIZE} slots. You have {RPG_PRESET_COUNT} parties; RPG levels belong to each Uma and are shared by every party.</p>
      <p>Pick a party, then a chapter. Each chapter is one scenario and spans ten levels: URA Finale Lv1–10, Unity Cup Lv11–20, and onward.</p>
    </> },
    { id: 'class', title: 'Class and elements', body: <>
      <div className="grid grid-cols-2 gap-2">{weapons.map(weapon => <div key={weapon} className="flex items-center gap-2 rounded-sm border border-hairline-dark bg-stage-soft p-2 text-xs"><IdentityGlyph weapon={weapon} />{RPG_WEAPON_LABELS[weapon]}</div>)}</div>
      <p>An A running style picks the class: Front → Greatsword, Pace → Spear or Sword + shield, Late → Wizard or Cleric staff, End → Tome.</p>
      <p>Distance A/B picks elements: Sprint → Dark/Light, Mile → Ice/Light, Medium → Fire/Dark, Long → Lightning/Light. B stops at depth {RPG_B_MAX_DEPTH}. Skills open at Lv{RPG_DEPTH_GATES.join(' / ')}.</p>
    </> },
    { id: 'turn', title: 'Taking a turn', body: <>
      <p>Each Uma acts once a round, in any order. Tap an enemy to <b>Attack</b> with her weapon, or pick a <b>Skill</b> first. <b>Guard</b> takes half of one hit for an ally. Enemies act after your last Uma.</p>
      <p className={card}>Every enemy shows its next move and target. There is no healing: win by knocking the enemy party out first.</p>
    </> },
    { id: 'weakness', title: 'Shields and weaknesses', body: <>
      <p>Every enemy carries a <b>shield</b> number and icons for what it is weak to: one element and two or more weapons.</p>
      <p className={card}>Attack hits with your weapon (both staves count as Staff). Skills hit with their element. Each hit on a weakness takes one point off the shield and deals 30% more; Twin, Triple, Quad and Barrage skills chip once per hit.</p>
      <p>Until its shield breaks, an enemy takes only half damage.</p>
    </> },
    { id: 'bosses', title: 'Break!', body: <>
      <p>At zero the enemy <b>Breaks</b>: it loses this round's and the next round's turn and takes full damage. Then its shield returns. Chip with attacks and cheap skills, then spend your big skills on the Break.</p>
      <p>Regular foes carry 2–3 points, sub-bosses 4 and champions 6. Each chapter ends in five champions, one per element; pick the route your party can break.</p>
    </> },
    { id: 'mp', title: 'MP and camps', body: <>
      <p>HP is full at the start of every fight. MP is not: what you spend carries to the next fight.</p>
      <p className={card}>Tap a camp you have reached to rest and refill everyone's MP. Use skills where they count; regular fights mostly need attacks and a well-placed weakness.</p>
    </> },
    { id: 'map', title: 'The map and rewards', body: <>
      <p>Clear a node to open the nodes below it. Every fight can be replayed any time.</p>
      <p>Every win pays EXP and the chapter's Inspiration tokens: {RPG_BATTLE_TOKENS.fight.slot} Slot + {RPG_BATTLE_TOKENS.fight.skill} Skill per fight, more from sub-bosses and champions. EXP grows when the enemies outlevel you and shrinks when you outlevel them.</p>
      <p>Tokens first repay your Inspiration advance, then land in Items.</p>
    </> },
  ]
  return <RpgModalFocus onClose={onClose}><PagedGuide open pages={pages} startAt={startAt} titleId="rpg-campaign-guide" finishLabel="Got it" onClose={onClose} /></RpgModalFocus>
}
