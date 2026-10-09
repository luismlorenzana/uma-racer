// Campaign guide (docs/design/uma-rpg.md, docs/design/uma-rpg-classes.md, D261–D282); read-only.
import { RPG_BATTLE_TOKENS, RPG_CHAPTER_LEVELS, RPG_DEPTH_GATES, RPG_MAX_ACTIVE_SLOTS, RPG_PARTY_SIZE, RPG_PRESET_COUNT,
  RPG_VARIANTS_PER_TREE, RPG_WEAPONS } from '@racer/domain'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { IdentityGlyph, RPG_WEAPON_LABELS } from '../../ui/rpg/RpgPortrait'
import { createGuideMemory } from '../../ui/minigames/guide-memory'

export const rpgGuideMemory = createGuideMemory('uma-racer:rpg-guide-v3')
export type RpgGuidePage = 'party' | 'class' | 'turn' | 'trees' | 'weakness' | 'bosses' | 'mp' | 'map'
export function RpgGuide({ onClose, startAt = 'party' }: { onClose: () => void; startAt?: RpgGuidePage }) {
  const card = 'rounded-md border border-hairline-dark bg-stage-soft p-3 text-sm'
  const pages: PagedGuidePage<RpgGuidePage>[] = [
    { id: 'party', title: 'Five Umas, one party', body: <>
      <p>Enroll owned Umas in the Roster, then fill a party's {RPG_PARTY_SIZE} slots. You have {RPG_PRESET_COUNT} parties; RPG levels belong to each Uma and are shared by every party.</p>
      <p>Pick a party, then a chapter. Each chapter is one scenario and spans {RPG_CHAPTER_LEVELS} levels: URA Finale Lv1–{RPG_CHAPTER_LEVELS}, Unity Cup Lv{RPG_CHAPTER_LEVELS + 1}–{RPG_CHAPTER_LEVELS * 2}, and onward.</p>
    </> },
    { id: 'class', title: 'Five classes', body: <>
      <p className={card}>Her A running styles pick the class: Front or Front + Pace → <b>Brawler</b>; Pace or Pace + Late → <b>Mage</b> or <b>Spell Blade</b>; Late → <b>Cleric</b>; End or Late + End → <b>Summoner</b>. Anything else chooses.</p>
      <p>Brawlers take Greatsword + Spear or Axe + Bow; Mages a Mage Staff + Arcane Staff; Spell Blades a Short Sword. Class and weapons change freely until she learns a skill. Skills open at Lv{RPG_DEPTH_GATES.join(' / ')}.</p>
      <div className="grid grid-cols-3 gap-1.5">{RPG_WEAPONS.map((weapon) => <div key={weapon} className="flex items-center gap-1 rounded-sm border border-hairline-dark bg-stage-soft p-1.5 text-[11px]"><IdentityGlyph weapon={weapon} />{RPG_WEAPON_LABELS[weapon]}</div>)}</div>
    </> },
    { id: 'turn', title: 'Taking a turn', body: <>
      <p>A <b>Brawler</b> acts once with either weapon. A <b>Mage</b> casts twice. A <b>Spell Blade</b> acts twice at half strength: every skill is a Short Sword cut with an element in the same hit, or arcane and sword hits in turn. A <b>Cleric</b>'s cast carries a blessing. A <b>Summoner</b> summons twice, and her Familiar attacks free once a round.</p>
      <p className={card}>Tap an enemy to attack, or pick a skill first. <b>Guard</b> ends her turn and takes half of one hit for an ally. Enemies act after your last action, and every enemy shows its next move.</p>
    </> },
    { id: 'trees', title: 'Skill trees', body: <>
      <p>Each class has two trees of three branches. A skill costs its depth in points, and every core skill fits by Lv40.</p>
      <p className={card}>Beside most core skills, a <b>fork</b> offers two variants: more hits, every foe, a second element and so on. Take one side of each fork, up to {RPG_VARIANTS_PER_TREE} per tree, and swap them any time.</p>
      <p>Equip up to {RPG_MAX_ACTIVE_SLOTS} skills per party slot. Cleric blessings never need a slot.</p>
    </> },
    { id: 'weakness', title: 'Shields and weaknesses', body: <>
      <p>Every enemy carries a <b>shield</b> number and icons for what it is weak to: elements first, then weapons.</p>
      <p className={card}>A hit can have two parts, like 75% Greatsword + 25% Fire. Each part on a weakness deals 30% more and takes one point off the shield, so a two-part hit can take two. Ultima deals 20% more to everything but never breaks a shield.</p>
      <p>Until its shield breaks, an enemy takes only half damage.</p>
    </> },
    { id: 'bosses', title: 'Break!', body: <>
      <p>At zero the enemy <b>Breaks</b>: it loses this round's and the next round's turn and takes full damage. Then its shield returns. Chip with attacks and cheap skills, then spend your big skills on the Break.</p>
      <p className={card}>Every attack and skill charges an Uma's <b>Limit Break</b>. When it is full, an <b>LB</b> badge sits on her portrait: tap it for her Limit Break, her whole turn at about twice the damage and 0 MP. Keep it for a Break if you like; it waits until you use it.</p>
      <p>Regular foes show five weaknesses and a 3–4 shield, sub-bosses four and 6, champions three and 8. The Finals has five routes, one per element; pick the one your party can break.</p>
    </> },
    { id: 'mp', title: 'MP, blessings and camps', body: <>
      <p>HP is full at the start of every fight. MP is not: what you spend carries to the next fight. Tap a camp you have reached to rest and refill everyone's MP.</p>
      <p className={card}>A Cleric's Light casts buff the party, Dark casts weaken the foes they hit, and Ultima casts lay Barriers and heal. One foe: three stacks on one ally; every foe: one stack on everyone; random hits: scattered stacks.</p>
    </> },
    { id: 'map', title: 'The map and rewards', body: <>
      <p>Clear a node to open the nodes below it. Every fight can be replayed any time.</p>
      <p>Every win pays EXP and the chapter's Inspiration tokens: {RPG_BATTLE_TOKENS.fight.slot} Slot + {RPG_BATTLE_TOKENS.fight.skill} Skill per fight, more from sub-bosses and champions. EXP grows when the enemies outlevel you and shrinks when you outlevel them.</p>
      <p>Tokens first repay your Inspiration advance, then land in Items. <b>Inventory</b> lists them and how much of the advance is repaid; <b>Convert</b> trades two of a scenario's tokens for one of the next, or one for two of the scenario before.</p>
    </> },
  ]
  return <RpgModalFocus onClose={onClose}><PagedGuide open pages={pages} startAt={startAt} titleId="rpg-campaign-guide" finishLabel="Got it" onClose={onClose} /></RpgModalFocus>
}
