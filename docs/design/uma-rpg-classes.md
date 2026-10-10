# Global Uma RPG — classes and skill trees

> **Status: current (D277–D282, approved 2026-10-08; the Spell Blade, D310, and Limit Breaks, D311, 2026-10-09).** It replaces the running-style weapons, the distance-affinity
> element trees, skill levels and the single-element weakness of [uma-rpg.md](uma-rpg.md) (D226, D227, D259, D264,
> D265 in part) and lifts D261's "no healing" for the Cleric only. Numbers are tuning drafts pinned by
> `packages/domain/src/domain.test.ts` and checked with `pnpm sim:rpg:campaign`; the code lives in
> `packages/domain/src/rpg/catalog.ts`.

The owner outlined four classes, then split the Mage's Short Sword sets into a fifth, the Spell Blade (D310); this
document authors every tree, node and number. Every skill's power and MP come
from one set of rules (section 5), so a rebalance changes a rule, not 330 cells.

## 1. Classes

An Uma's class comes from her **A running styles**:

| Class | Running styles (A) | Catalog outfits | Weapons | Actions a turn | Role |
|---|---|---|---|---|---|
| **Brawler** | Front, or Front + Pace | 46 | Greatsword + Spear, **or** Axe + Bow (chosen at enrollment) | 1 | Weapon damage with an elemental splash; best free shield chips |
| **Mage** | Pace, or Pace + Late (her choice, or Spell Blade) | 138 | Mage Staff + Arcane Staff, fixed | 2 casts | Pure magic burst; the deepest MP pool |
| **Spell Blade** | Pace, or Pace + Late (her choice, or Mage) | (the same 138) | Short Sword, fixed | 2 half-strength actions | Half magic, half blade: every skill cuts with the sword and an element or arcane magic; the hardest shield breaker |
| **Cleric** | Late only | 46 | Arcane Staff (main) + Cleric Staff (off), fixed | 1 cast + a blessing | Buffs, debuffs, barriers and heals, with Light/Dark/Ultima damage |
| **Summoner** | End, or Late + End | 33 | Summoner Tome, fixed | 2 summons | True hybrid: every damage kind at half strength |

- An outfit whose A styles match none of the rows (5 of 268: Pace+Late+End, Pace+End, Front+Late) **chooses** among
  the classes of its single A styles (Front → Brawler, Pace → Mage or Spell Blade, Late → Cleric, End → Summoner).
- Class and weapon picks can change freely while the Uma has **no learned skills**, at any level (replaces D259's
  Tier 1 Lv1 window). After the migration every Uma qualifies once.
- Distance aptitudes, element affinities (A/B depth limits) and the +10% signature element are **retired**: the class
  decides everything.
- The owner's party plan, 1 Brawler + 2 Pace Umas (Mage or Spell Blade) + 1 Cleric + 1 Summoner, matches the
  catalog's split. Parties are not forced into it.

**Class stats.** The shared projection stays (ATK = MATK = Speed, DEF = Power, HP and MP as today); each class leans it:

| Class | HP | ATK | MATK | DEF | M.DEF | MP |
|---|---|---|---|---|---|---|
| Brawler | ×1.15 | ×1.1 | ×0.9 | ×1.1 | ×0.9 | ×0.8 |
| Mage | ×0.9 | ×0.9 | ×1.15 | ×0.9 | ×1.1 | ×1.3 |
| Spell Blade | ×1.0 | ×1.05 | ×1.05 | ×1.0 | ×1.0 | ×1.0 |
| Cleric | ×1.0 | ×0.8 | ×1.0 | ×1.0 | ×1.15 | ×1.3 |
| Summoner | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.1 |

## 2. Turns and hands

Allies still act in any order, then foes act. Some classes act twice; an Uma may split her two actions around
other Umas' turns. **Guard** ends her turn (all remaining actions).

| Build | Each turn | Skill power (hand factor) | Skill MP | Free action (0 MP) |
|---|---|---|---|---|
| Brawler | 1 action: Attack with **either** weapon, or a skill from either tree (two skill menus) | ×1.0 | ×1.0 | Attack 1.0, one weapon hit |
| Mage | 2 casts, any trees | ×0.6 each | ×0.6 each | Staff strike 0.4 each, no element |
| Spell Blade | 2 actions: Slash or a skill from either tree | ×0.5 each | ×0.5 each | Slash 0.5 each, one Short Sword hit |
| Cleric | 1 Arcane cast + one blessing from the matching Cleric Staff branch | ×0.5 | ×0.7 | Staff strike 0.5, no element |
| Summoner | 2 summons | ×0.5 each | ×0.5 each | **Familiar** 0.5 (once a round), one hit of her chosen weapon form |

- Cleric blessings ride **skills only**, never free actions. (The Mage's Short Sword follow-ups retired with D310.)
- The Familiar's form (Greatsword skeleton, Spear lancer, Axe reaver, Bow ranger or Short Sword duelist) is chosen
  per party slot, like the old signature element.
- Every action, skill and follow-up is one command: the off-hand needs no extra taps. A Cleric with more than one
  learned blessing in the matching branch picks it in a small row under the skill (the last one is preselected).

## 3. Damage, weaknesses and breaks

**Kinds.** Five weapon kinds (Greatsword, Spear, Axe, Bow, Short Sword) and five elements (Fire, Ice, Lightning, Light,
Dark) can be weaknesses: ten in all. **Ultima** deals ×1.2 against everything and is never a weakness. Staves, the
Cleric Staff and the Summoner Tome are not damage kinds.

**Hits and parts.** A hit lands on one foe and has one to three **parts**, each with its own kind and share of the hit's
power (a Greatsword hit is 75% Greatsword + 25% Fire). Each part:

- deals `share × power × max(0.2 × offense, offense − 0.5 × defense)`, using ATK/DEF for weapon parts and MATK/M.DEF
  for element and Ultima parts;
- ×1.3 when its kind is one of the foe's weaknesses, and **removes one shield point** (so a two-part hit can remove
  two);
- ×0.5 while the foe's shield stands (the Ultima capstone is exempt); statuses as in section 4.

**Weakness counts.** Weaker foes show more icons, stronger foes fewer but larger shields:

| Rank | Weapon + element weaknesses | Shield |
|---|---|---|
| Regular | 3 + 2, or 2 + 3 | 2 (3 from Senior Year) |
| Sub-boss | 2 + 2 | 6 |
| Champion | 2 + 1, or 1 + 2 | 8 |

A foe is never weak to its own element; its first element weakness is the one that beats it (Fire > Ice > Lightning >
Fire; Light ↔ Dark), so the Finals routes still read by element. Regular foes always show at least two weapon
weaknesses, so no regular fight needs a particular class. Breaks work as D265: a Broken foe loses that round's and the
next round's action, takes full damage, then raises its shield again. Boss shields rise from 4/6 to 6/8 because
two-action classes land more hits a round; regular shields stay at 2/3 so the thirty regular fights of a chapter stay
quick (the sim put them at 4–8 rounds with 3/4).

## 4. Statuses

Stacks cap at 3 and last 2 rounds (refreshed when reapplied) unless a node says otherwise.

| Status | On | Per stack |
|---|---|---|
| Brave | ally | +10% weapon damage dealt |
| Faith | ally | +10% element and Ultima damage dealt |
| Breaker | ally | a charge: her next weak hit removes 1 more shield point (consumed; up to 3 charges) |
| Barrier | ally | absorbs damage worth 8% of her max HP |
| Regen | ally | heals 4% of max HP at the end of each round |
| Aegis | ally | −10% damage taken |
| Armor Break | foe | +10% weapon damage taken |
| Mind Break | foe | +10% element and Ultima damage taken |
| Enfeeble (also "Chill") | foe | −10% damage dealt |
| Shock | foe | +10% damage taken from everything |
| Burn | foe | 4% of max HP at the end of each round |
| Hex | foe | weak to Light and Dark for 2 rounds (no stacks) |

Element riders: **Fire → Burn, Ice → Chill, Lightning → Shock**, on capstones and on the nodes that say so. Ordinary
hits carry no status, so elemental splashes do not spam effects. Foes' own moves keep their statuses (burn, slow,
mark, weaken).

## 5. Points, variants and slots

- **Points are unchanged:** two a level up to Lv45 plus five whenever a depth opens (Lv1/10/20/30/40): 115 at Lv45.
- **Skill levels are gone.** A node is learned once; Fire → Fira → Firaga → Firaja is the power curve. A cheap low
  tier stays useful because MP carries between fights.
- **Core nodes** cost their depth (1–5), so a branch is 15 points and a class's six branches are 90. Every core node
  is learned by Lv40 (105 points earned).
- **Variants** (side nodes) sit at depths 2, 3 and 4 as a **fork** of two alternatives (A or B) beside the core node,
  which they require. Cost = depth. Limits: one side of each fork, and **three variants per tree** (six per Uma).
  The full build (90 + at most 24) fits in 115 by Lv45.
- **Variants can be swapped freely outside a fight** (points refund). Core nodes are permanent.
- **Slots stay at ten** (three at Lv1, one more at Lv 10, 15, 20, 25, 30, 35, 40) and hold active skills from either
  tree. Cleric blessings are passive and never use a slot.
- Promotion is unchanged: each tier re-learns the class trees, MP costs scale with the tier, two legacy skills carry.

**Reading the tables below.** Powers are in full-turn units (Attack = 1.0) before the hand factor of section 2.
`one` hits the tapped foe, `all` hits every foe (power per foe), `random` picks a living foe for each hit (a lone foe
takes them all). MP is the full-turn cost: `6 + 4 × depth`, +4 for every-foe skills, ±2 for heavier variants.
The rules behind every number: single-target power 1.6 / 2.2 / 2.9 / 3.7 / 4.6 by depth; every-foe skills 55% of that
per foe; random multi-hits ×1.05; "heavy" variants ×1.15 for +2 MP; "more hits" variants ×0.92.

## 6. Brawler trees

Each tree has Fire, Ice and Lightning branches with the same numbers. Hits are two-part (75% weapon + 25% element) for
the Greatsword and Axe; Spear and Bow hits **alternate** weapon and element, the weapon hits carrying 75% of the total.

### Greatsword — single foe, one to three heavy hits

| Depth | Core | Variant A · Heavy (fewer, bigger hits) | Variant B · Rapid (one more hit) |
|---|---|---|---|
| 1 | one · 1 hit · 1.6 · 10 MP | — | — |
| 2 | one · 1 hit · 2.2 · 14 MP | one · 1 hit · 2.53 · 16 MP | one · 2 hits · 2.02 · 14 MP |
| 3 | one · 2 hits · 2.9 · 18 MP | one · 1 hit · 3.34 · 20 MP | one · 3 hits · 2.67 · 18 MP |
| 4 | one · 2 hits · 3.7 · 22 MP | one · 1 hit · 4.26 · 24 MP | one · 3 hits · 3.4 · 22 MP |
| 5 | one · 3 hits · 4.6 · 26 MP · rider ×2 | — | — |

| Depth | Fire | Ice | Lightning |
|---|---|---|---|
| 1 | Flame Slash | Frost Slash | Volt Slash |
| 2 | Blazing Cleave (A Searing Crush · B Twin Embers) | Rime Cleave (A Avalanche Crush · B Twin Icicles) | Thunder Cleave (A Storm Crush · B Twin Sparks) |
| 3 | Inferno Edge (A Magma Breaker · B Ember Flurry) | Glacier Edge (A Permafrost Breaker · B Hailstorm Flurry) | Tempest Edge (A Thunderclap Breaker · B Static Flurry) |
| 4 | Volcanic Rend (A Cataclysm · B Wildfire Combo) | Frozen Rend (A Iceberg Splitter · B Blizzard Combo) | Lightning Rend (A Judgment Blade · B Chain Combo) |
| 5 | **Meteor Strike** · Burn 2 | **Glacial Execution** · Chill 2 | **Heaven's Fury** · Shock 2 |

### Spear — random foes, two to six alternating hits

| Depth | Core | Variant A · Pierce (half the hits, on the tapped foe) | Variant B · Prism (+2 hits of the next element) |
|---|---|---|---|
| 1 | random · 2 hits · 1.68 · 10 MP | — | — |
| 2 | random · 2 hits · 2.31 · 14 MP | one · 1 two-part hit · 2.53 · 16 MP | random · 4 hits · 2.97 · 18 MP |
| 3 | random · 4 hits · 3.05 · 18 MP | one · 2 two-part hits · 3.34 · 20 MP | random · 6 hits · 3.92 · 22 MP |
| 4 | random · 4 hits · 3.89 · 22 MP | one · 2 two-part hits · 4.26 · 24 MP | random · 6 hits · 5.0 · 26 MP |
| 5 | random · 6 hits · 4.83 · 26 MP · rider per element hit | — | — |

Prism's extra hits use the element each branch beats: Fire adds Ice, Ice adds Lightning, Lightning adds Fire.

| Depth | Fire | Ice | Lightning |
|---|---|---|---|
| 1 | Ember Thrust | Frost Thrust | Spark Thrust |
| 2 | Flame Lance (A Searing Pierce · B Steam Lance) | Ice Lance (A Glacial Pierce · B Frostvolt Lance) | Volt Lance (A Thunder Pierce · B Plasma Lance) |
| 3 | Burning Barrage (A Magma Pierce · B Steam Barrage) | Shard Barrage (A Permafrost Pierce · B Frostvolt Barrage) | Static Barrage (A Storm Pierce · B Plasma Barrage) |
| 4 | Inferno Spiral (A Inferno Pierce · B Steam Spiral) | Blizzard Spiral (A Absolute Pierce · B Frostvolt Spiral) | Thunder Spiral (A Heaven Pierce · B Plasma Spiral) |
| 5 | **Dragon's Rain** · Burn per Fire hit | **Glacier Rain** · Chill per Ice hit | **Storm Rain** · Shock per Lightning hit |

### Axe — every foe, one to three two-part hits

| Depth | Core | Variant A · Rampage (one more hit on every foe) | Variant B · Executioner (lighter sweep + a hit on the tapped foe) |
|---|---|---|---|
| 1 | all · 1 hit · each foe 0.88 · 14 MP | — | — |
| 2 | all · 1 hit · each foe 1.21 · 18 MP | all · 2 hits · each foe 1.1 · 20 MP | all · 1 hit · each foe 0.99 + tapped foe 1.1 · 20 MP |
| 3 | all · 2 hits · each foe 1.6 · 22 MP | all · 3 hits · each foe 1.45 · 24 MP | all · 2 hits · each foe 1.31 + tapped foe 1.45 · 24 MP |
| 4 | all · 2 hits · each foe 2.04 · 26 MP | all · 3 hits · each foe 1.85 · 28 MP | all · 2 hits · each foe 1.67 + tapped foe 1.85 · 28 MP |
| 5 | all · 3 hits · each foe 2.53 · 30 MP · rider ×1 on each foe | — | — |

| Depth | Fire | Ice | Lightning |
|---|---|---|---|
| 1 | Flame Sweep | Frost Sweep | Volt Sweep |
| 2 | Blazing Whirl (A Ember Rampage · B Pyre Execution) | Rime Whirl (A Hail Rampage · B Frostbite Execution) | Thunder Whirl (A Spark Rampage · B Storm Execution) |
| 3 | Inferno Cyclone (A Blaze Rampage · B Searing Execution) | Glacier Cyclone (A Sleet Rampage · B Rime Execution) | Tempest Cyclone (A Static Rampage · B Thunder Execution) |
| 4 | Volcanic Quake (A Inferno Rampage · B Cinder Execution) | Avalanche Quake (A Blizzard Rampage · B Glacier Execution) | Thunderclap Quake (A Tempest Rampage · B Judgment Execution) |
| 5 | **Firestorm** · Burn 1 each | **Absolute Maelstrom** · Chill 1 each | **Thunderstorm** · Shock 1 each |

### Bow — the tapped foe, two to six alternating hits

| Depth | Core | Variant A · Power Shot (half the hits, bigger) | Variant B · Burst (the last arrow splashes every other foe) |
|---|---|---|---|
| 1 | one · 2 hits · 1.6 · 10 MP | — | — |
| 2 | one · 2 hits · 2.2 · 14 MP | one · 1 two-part hit · 2.53 · 16 MP | one · 2 hits · 2.2, splash 0.44 · 18 MP |
| 3 | one · 4 hits · 2.9 · 18 MP | one · 2 two-part hits · 3.34 · 20 MP | one · 4 hits · 2.9, splash 0.58 · 22 MP |
| 4 | one · 4 hits · 3.7 · 22 MP | one · 2 two-part hits · 4.26 · 24 MP | one · 4 hits · 3.7, splash 0.74 · 26 MP |
| 5 | one · 6 hits · 4.6 · 26 MP · rider per element hit | — | — |

The splash is an element hit on each other foe (it can remove a shield point).

| Depth | Fire | Ice | Lightning |
|---|---|---|---|
| 1 | Fire Arrow | Ice Arrow | Spark Arrow |
| 2 | Twin Flame Arrows (A Searing Shot · B Exploding Arrow) | Twin Frost Arrows (A Icicle Shot · B Shatter Arrow) | Twin Volt Arrows (A Rail Shot · B Arc Arrow) |
| 3 | Blazing Quiver (A Magma Shot · B Cluster Fire) | Frozen Quiver (A Glacial Shot · B Frost Cluster) | Static Quiver (A Volt Shot · B Chain Cluster) |
| 4 | Inferno Volley (A Sun Lance Shot · B Napalm Volley) | Blizzard Volley (A Comet Shot · B Hail Volley) | Thunder Volley (A Thunderbolt Shot · B Storm Volley) |
| 5 | **Sunfall Barrage** | **Diamond Dust Barrage** | **Thunderhead Barrage** |

## 7. Mage and Spell Blade trees

### Mage Staff — Fire hits one foe, Ice hits every foe, Lightning rains random hits

Every hit is pure element. Each branch's variants recast that tier in the other two shapes.

| Depth | Fire (one) | Ice (every foe) | Lightning (random) |
|---|---|---|---|
| 1 | **Fire** · 1 hit · 1.6 · 10 MP | **Blizzard** · each foe 0.88 · 14 MP | **Thunder** · 2 hits · 1.68 · 10 MP |
| 2 | **Fira** · 2.2 · 14 MP | **Blizzara** · each foe 1.21 · 18 MP | **Thundara** · 2 hits · 2.31 · 14 MP |
| 3 | **Firaga** · 2.9 · 18 MP | **Blizzaga** · each foe 1.6 · 22 MP | **Thundaga** · 3 hits · 3.05 · 18 MP |
| 4 | **Firaja** · 3.7 · 22 MP | **Blizzaja** · each foe 2.04 · 26 MP | **Thundaja** · 3 hits · 3.89 · 22 MP |
| 5 | **Flare Star** · 4.6 · 26 MP · Burn 2 | **Absolute Zero** · 2 hits, each foe 2.53 · 30 MP · Chill 1 | **Judgment Storm** · 4 hits · 4.83 · 26 MP · Shock 1 per hit |

| Fork | Fire variants | Ice variants | Lightning variants |
|---|---|---|---|
| 2 | A **Fira Wave** (every foe 1.21 · 18) · B **Fira Chain** (random 2 hits 2.31 · 14) | A **Blizzara Spike** (one 2.2 · 14) · B **Blizzara Shards** (random 2 hits 2.31 · 14) | A **Thundara Bolt** (one 2.2 · 14) · B **Thundara Storm** (every foe 1.21 · 18) |
| 3 | A Firaga Wave (1.6 · 22) · B Firaga Chain (3 hits 3.05 · 18) | A Blizzaga Spike (2.9 · 18) · B Blizzaga Shards (3 hits 3.05 · 18) | A Thundaga Bolt (2.9 · 18) · B Thundaga Storm (1.6 · 22) |
| 4 | A Firaja Wave (2.04 · 26) · B Firaja Chain (3 hits 3.89 · 22) | A Blizzaja Spike (3.7 · 22) · B Blizzaja Shards (3 hits 3.89 · 22) | A Thundaja Bolt (3.7 · 22) · B Thundaja Storm (2.04 · 26) |

### Arcane Staff — Light and Dark hit every foe, Ultima rains random hits

Shared by the Mage and the Cleric (at the Cleric's ×0.5). Light and Dark have the same numbers.

| Depth | Light | Dark | Ultima (×1.2, never weak) |
|---|---|---|---|
| 1 | **Lux** · each foe 0.88 · 14 MP | **Nox** · each foe 0.88 · 14 MP | **Arcana** · 2 hits · 1.68 · 12 MP |
| 2 | **Luxra** · each foe 1.21 · 18 MP | **Noxra** · each foe 1.21 · 18 MP | **Arcanara** · 2 hits · 2.31 · 16 MP |
| 3 | **Luxaga** · each foe 1.6 · 22 MP | **Noxaga** · each foe 1.6 · 22 MP | **Arcanaga** · 3 hits · 3.05 · 20 MP |
| 4 | **Luxaja** · each foe 2.04 · 26 MP | **Noxaja** · each foe 2.04 · 26 MP | **Arcanaja** · 3 hits · 3.89 · 24 MP |
| 5 | **Holy** · 2 hits, each foe 2.53 · 30 MP · Broken foes take +30% | **Black Hole** · 2 hits, each foe 2.53 · 30 MP · foes under half HP take +30% | **Ultima** · 4 hits · 4.83 · 28 MP · full damage before a Break |

| Fork | Light / Dark variants | Ultima variants |
|---|---|---|
| 2 | A **Luxra / Noxra Lance** (one 2.2 · 14) · B **Luxra / Noxra Cascade** (2 hits, each foe 1.1 · 20) | A **Arcanara Dawn** (+ a Light hit last: 3 hits 2.86 · 18) · B **Arcanara Dusk** (+ a Dark hit last) |
| 3 | A Luxaga / Noxaga Lance (2.9 · 18) · B Cascade (each foe 1.45 · 24) | A Arcanaga Dawn (4 hits 3.77 · 22) · B Arcanaga Dusk |
| 4 | A Luxaja / Noxaja Lance (3.7 · 22) · B Cascade (each foe 1.85 · 28) | A Arcanaja Dawn (4 hits 4.81 · 26) · B Arcanaja Dusk |

Ultima never removes shield points; its Dawn/Dusk variants add one Light or Dark hit that can.

### Short Sword follow-ups — retired (D310)

The Mage no longer carries a Short Sword, so its passive follow-up tree (Duel, Melee, Tempo) is open to no class and
the engine no longer runs follow-ups. Its node ids still read, so old rows parse; D278 records how it worked.

### Spell Blade — Elemental Blade: one foe, the sword and an element in the same hit

The Greatsword's tree for a two-action hand: every hit is **50% Short Sword + 50% element** in one hit (two parts, so a
foe weak to both loses two shield points a hit), at ×0.5 a cast, twice a turn. Fire, Ice and Lightning have the same
numbers; the capstone carries its element's rider.

| Depth | Core | Variant A · Heavy (one bigger hit) | Variant B · Rapid (one more hit) |
|---|---|---|---|
| 1 | one · 1 hit · 1.6 · 10 MP | — | — |
| 2 | one · 1 hit · 2.2 · 14 MP | one · 1 hit · 2.53 · 16 MP | one · 2 hits · 2.02 · 14 MP |
| 3 | one · 2 hits · 2.9 · 18 MP | one · 1 hit · 3.34 · 20 MP | one · 3 hits · 2.67 · 18 MP |
| 4 | one · 2 hits · 3.7 · 22 MP | one · 1 hit · 4.26 · 24 MP | one · 3 hits · 3.4 · 22 MP |
| 5 | one · 3 hits · 4.6 · 26 MP · rider ×2 | — | — |

| Depth | Fire | Ice | Lightning |
|---|---|---|---|
| 1 | Fire Blade | Frost Blade | Thunder Blade |
| 2 | Flame Brand (A Searing Strike · B Twin Flames) | Ice Brand (A Shatter Strike · B Twin Frost) | Volt Brand (A Bolt Strike · B Twin Volts) |
| 3 | Blazing Saber (A Magma Strike · B Flame Dance) | Rime Saber (A Permafrost Strike · B Frost Dance) | Storm Saber (A Thunderclap Strike · B Spark Dance) |
| 4 | Inferno Saber (A Solar Strike · B Wildfire Dance) | Glacial Saber (A Avalanche Strike · B Blizzard Dance) | Tempest Saber (A Judgment Strike · B Storm Dance) |
| 5 | **Phoenix Blade** · Burn 2 | **Diamond Blade** · Chill 2 | **Thunderlord Blade** · Shock 2 |

### Spell Blade — Arcane Blade: an arcane hit, then a Short Sword hit, again and again

Hits alternate **arcane, sword, arcane, sword…** (2 / 2 / 4 / 4 / 6 hits by depth), each half carrying half the power.
Light and Dark cut the tapped foe; Ultima's hits land on random foes (×1.05, +2 MP) and, as ever, never break a shield,
so its sword hits do. Capstones share the Arcane Staff's: Holy Blade hits Broken foes +30%, Abyss Blade foes under half
HP +30%, Ultima Blade deals full damage before a Break. Both variants keep the core and add **two hits at the end**,
worth 0.3 of the depth's power, for 4 MP more:

| Depth | Core (Light / Dark) | Variant A · Coda (+2 arcane hits) | Variant B · Riposte (+2 Short Sword hits) |
|---|---|---|---|
| 1 | one · 2 hits · 1.6 · 10 MP | — | — |
| 2 | one · 2 hits · 2.2 · 14 MP | one · 4 hits · 2.86 · 18 MP | one · 4 hits · 2.86 · 18 MP |
| 3 | one · 4 hits · 2.9 · 18 MP | one · 6 hits · 3.77 · 22 MP | one · 6 hits · 3.77 · 22 MP |
| 4 | one · 4 hits · 3.7 · 22 MP | one · 6 hits · 4.81 · 26 MP | one · 6 hits · 4.81 · 26 MP |
| 5 | one · 6 hits · 4.6 · 26 MP · capstone | — | — |

Ultima's Coda adds a **Light and a Dark** hit (so it can break a shield) instead of two more Ultima hits.

| Depth | Light | Dark | Ultima |
|---|---|---|---|
| 1 | Gleam Cut | Shade Cut | Arcane Cut |
| 2 | Radiant Flurry (A Radiant Coda · B Radiant Riposte) | Umbral Flurry (A Umbral Coda · B Umbral Riposte) | Arcane Flurry (A Arcane Twilight · B Arcane Riposte) |
| 3 | Dawn Waltz (A Dawn Coda · B Dawn Riposte) | Dusk Waltz (A Dusk Coda · B Dusk Riposte) | Mystic Waltz (A Mystic Twilight · B Mystic Riposte) |
| 4 | Sunburst Waltz (A Sunburst Coda · B Sunburst Riposte) | Eclipse Waltz (A Eclipse Coda · B Eclipse Riposte) | Astral Waltz (A Astral Twilight · B Astral Riposte) |
| 5 | **Holy Blade** | **Abyss Blade** | **Ultima Blade** |

## 8. Cleric trees

The Cleric casts from the **Arcane Staff** tree (section 7) at ×0.5. Each cast also carries one **blessing** from the
Cleric Staff branch its element points to; the cast's shape decides how the blessing lands.

| Cast element | Branch | Lands on |
|---|---|---|
| Light | **Grace** (buffs) | allies |
| Dark | **Malice** (debuffs) | the foes the cast struck |
| Ultima | **Sanctuary** (barriers and heals) | allies |

| Cast shape | Blessing shape |
|---|---|
| one foe (Lance variants) | **Focused:** 3 stacks on one ally (best fit, below) or on the struck foe |
| every foe (Light/Dark core, Cascade) | **Party:** 1 stack on every ally or every struck foe, per hit on each (up to 2) |
| random hits (Ultima) | **Scatter:** 1 stack per hit, each on a random ally or that hit's foe |

Focused blessings pick the ally who gains most: Brave → highest ATK; Faith and Exalt → highest MATK; Clarity → lowest
MP%; Breaker → highest ATK; Barrier, Regen, Aegis and Cure → lowest HP%; Rebirth → the first knocked-out ally.
Dawn/Dusk hits do not trigger a second blessing.

| Depth | Grace (Light) | Malice (Dark) | Sanctuary (Ultima) |
|---|---|---|---|
| 1 | **Brave** | **Armor Break** | **Barrier** |
| 2 | **Faith** · A **Lasting Grace** (Grace lasts 3 rounds) · B **Abundant Grace** (Party Grace gives 2 stacks) | **Mind Break** · A **Lingering Malice** (3 rounds) · B **Spreading Malice** (Focused Malice also gives every other foe 1 stack) | **Regen** · A **Lasting Sanctuary** (3 rounds) · B **Bulwark** (Barrier absorbs 10% per stack) |
| 3 | **Clarity** (restores 4% max MP per stack) · A **Second Blessing** (Focused Grace also gives the next-best ally 1 stack) · B **Inspiration** (every Grace stack also restores 1% max MP) | **Enfeeble** · A **Exploit** (+1 stack on a Broken foe) · B **Erosion** (a foe with 2+ Malice stacks raises its shield 1 lower after a Break) | **Aegis** · A **Purify** (also clears one debuff) · B **Overflow** (Cure past max HP becomes Barrier) |
| 4 | **Breaker** · A **Zeal** (Brave and Faith cap at 4) · B **Overcharge** (Breaker holds 5 charges) | **Hex** · A **Deep Hex** (3 rounds) · B **Doom Hex** (Hexed foes take +10% from everything) | **Cure** (heals 10% max HP per stack) · A **Miracle** (15% per stack) · B **Sacred Ground** (Regen also restores 1% max MP per stack) |
| 5 | **Exalt:** Brave and Faith together | **Shatter:** removes 1 shield point per stack at once (it can Break) | **Rebirth:** a knocked-out ally gets up with 10% max HP per stack, once per Uma per fight (a living ally gets Barrier instead) |

Healing returns only here, kept small (Cure and Regen); fights are still won by breaking and knocking foes out.

## 9. Summoner trees

Summons run at ×0.5 power and MP, two a turn. Every summon is a one-shot action, not a unit on the field.

### Elemental summons — every foe, multi-hit; variants turn the element into a weapon kind

| Depth | Fire | Ice | Lightning | Numbers (core and every variant) |
|---|---|---|---|---|
| 1 | **Ember Sprites** | **Frost Sprites** | **Spark Sprites** | all · 1 hit · each foe 0.88 · 14 MP |
| 2 | **Salamander** | **Snow Wolves** | **Thunderbird** | all · 2 hits · each foe 1.21 · 18 MP |
| 3 | **Fire Drake** | **Ice Golem** | **Storm Roc** | all · 2 hits · each foe 1.6 · 22 MP |
| 4 | **Infernal Wyrm** | **Frost Titan** | **Thunder Kirin** | all · 3 hits · each foe 2.04 · 26 MP |
| 5 | **Phoenix** · Burn 1 each | **Winter Queen** · Chill 1 each | **Raijin** · Shock 1 each | all · 3 hits · each foe 2.53 · 30 MP |

Each branch's variants drop the element for weapon damage, covering every weapon kind across its forks:

| Fork | Fire → Bone Legion | Ice → Frost Knights | Lightning → Clockwork |
|---|---|---|---|
| 2 | A Skeleton Swordsmen (Greatsword) · B Skeleton Lancers (Spear) | A Frost Knights (Greatsword) · B Ice Pikemen (Spear) | A Brass Knights (Greatsword) · B Gear Lancers (Spear) |
| 3 | A Skeleton Berserkers (Axe) · B Skeleton Archers (Bow) | A Glacier Reavers (Axe) · B Snow Rangers (Bow) | A Steam Reavers (Axe) · B Bolt Rangers (Bow) |
| 4 | A Skeleton Duelists (Short Sword) · B **Bone Legion** (hits cycle Greatsword → Spear → Axe → Bow → Short Sword) | A Frost Duelists (Short Sword) · B **Frozen Legion** (cycle) | A Spring Duelists (Short Sword) · B **Clockwork Legion** (cycle) |

### Arcane summons — Light, Dark or Ultima fused with weapons in the same hit

Angels and Demons hit with 50% arcane + 50% weapon parts; Archon hits are Ultima + a weapon part (only the weapon can
be weak).

| Depth | Angels (random · Light + Spear) | Demons (one · Dark + Greatsword) | Archons (random · Ultima + Spear/Bow, alternating) |
|---|---|---|---|
| 1 | **Cherub** · 1 hit · 1.68 · 10 MP | **Imp Brute** · 1 hit · 1.6 · 10 MP | **Herald** · 2 hits · 1.68 · 12 MP |
| 2 | **Angel Lancer** · 1 hit · 2.31 · 14 MP | **Hellknight** · 1 hit · 2.2 · 14 MP | **Archangel** · 2 hits · 2.31 · 16 MP |
| 3 | **Seraph Phalanx** · 1 hit · 3.05 · 18 MP | **Dread Knight** · 1 hit · 2.9 · 18 MP | **Archangel's Rain** · 3 hits · 3.05 · 20 MP |
| 4 | **Dominion Host** · 2 hits · 3.89 · 22 MP | **Demon Lord** · 2 hits · 3.7 · 22 MP | **Archangel's Judgment** · 3 hits · 3.89 · 24 MP |
| 5 | **Heaven's Legion** · 2 hits · 4.83 · 26 MP · every ally gains Barrier 1 | **Abyssal Overlord** · 2 hits · 4.6 · 26 MP · Enfeeble 2 | **Armageddon** · 4 hits · 4.83 · 32 MP · then an Archdemon sweep: every foe takes one Ultima + Axe hit at 1.15 |

| Fork | Angels | Demons | Archons |
|---|---|---|---|
| 2 | A **Angel Archer** (one · Light + Bow · 2.2 · 14) · B **Valkyrie** (one heavy · Light + Short Sword · 2.53 · 16) | A **Hell Reaver** (every foe · Dark + Axe · 1.21 · 18) · B **Nightmare** (Mind Break 1 per hit · 1.98 · 14) | A **Archdemon** (every foe · Ultima + Greatsword/Axe · 1.21 · 20) · B **Twilight Herald** (Ultima + Light/Dark · 2.31 · 16) |
| 3 | A Seraph Archers (2.9 · 18) · B Valkyrie Blade (3.34 · 20) | A Dread Reaver (1.6 · 22) · B Night Terror (2.61 · 18) | A Archdemon's Ruin (2 hits · 1.6 · 24) · B Twilight Archon (3 hits · 3.05 · 20) |
| 4 | A Dominion Volley (2 hits · 3.7 · 22) · B Valkyrie Charge (4.26 · 24) | A Abyss Reaver (2 hits · 2.04 · 26) · B Dream Eater (2 hits · 3.33 · 22) | A Archdemon's Cataclysm (2 hits · 2.04 · 28) · B Eclipse Archon (3 hits · 3.89 · 24) |

## 10. Balance check

One Uma, one turn, a lone foe, before defense, weaknesses and breaks. Full-turn MP units (×M) are the depth's MP.

| Build | Hand | Lv1 skill | Lv20 skill | Lv40 skill | MP a turn | Free turn | Shield points a turn, max (Lv1 / 20 / 40) |
|---|---|---|---|---|---|---|---|
| Brawler · Greatsword | 1 × 1.0 | 1.6 | 2.9 | 4.6 | 1.0 × M | Attack 1.0, 1 point | 2 / 4 / 6 |
| Brawler · Spear | 1 × 1.0 | 1.68 | 3.05 | 4.83 | 1.0 × M | Attack 1.0, 1 point | 2 / 4 / 6 |
| Mage | 2 × 0.6 | 1.92 | 3.48 | 5.52 | 1.2 × M | 0.8, no points | 4 / 6 / 8 (Lightning twice) |
| Spell Blade | 2 × 0.5 | 1.6 | 2.9 | 4.6 | 1.0 × M | Slash 2 × 0.5, 2 points | 4 / 8 / 12 (Elemental Blade twice, both parts weak) |
| Cleric | 0.5 + a blessing | 0.8 | 1.45 | 2.3 | 0.7 × M | 0.5, no points | 1 / 1 / 4 (with Shatter) |
| Summoner · two summons | 2 × 0.5 | 1.6 | 2.9 | 4.6 | 1.0 × M | Familiar 0.5, 1 point | 4 / 6 / 8 (Archons twice) |

- Every build lands near the same damage a turn. The Mage trades MP for the most burst; the Spell Blade breaks shields
  fastest against foes weak to the Short Sword and her element, two parts a hit, twice a turn; the Brawler has the
  strongest free turn; the Cleric's blessing is worth roughly the
  half of her damage she gives up (one Party Brave lifts four Umas by 10% for two rounds).
- MP pools against the depth's cost, at chapter ends (MP refills at any reached camp, so this is per fight):

| Class | Lv12 pool → skills | Lv24 pool → skills | Lv48 pool → skills |
|---|---|---|---|
| Brawler | 59 → 4 | 83 → 4–5 | 130 → 5 |
| Mage | 96 → 11 casts | 135 → 12 | 212 → 13 |
| Spell Blade | 74 → 10 casts | 104 → 11 | 163 → 12 |
| Cleric | 96 → 10 | 135 → 10–11 | 212 → 11–12 |
| Summoner | 81 → 9 summons | 114 → 10 | 179 → 12 |

A regular fight lasts 3–5 rounds and a champion 6–10, so no class can use skills every round of a boss fight. Free
actions and blessings fill the gaps.

## 11. Foes and the campaign

Chapters, the map, EXP and tokens (D262–D266) are unchanged. Foes get the weakness counts and shields of section 3;
regular foes keep D265's HP, offense and moves. **Sub-boss and champion HP also scale with the skill power open at
the chapter's first level** against depth 1 (`rpgChapterReach`): URA ×1, Unity Cup ×1.375 (depth 2), the third
chapter ×1.81, then ×2.31 and ×2.875; a Tier 2 chapter starts over with its tier's depths. Boss fights are where a
party spends its whole MP pool, and that pool's damage grows with depth faster than foe stats grow with level.

`pnpm sim:rpg:campaign` (a Brawler, a Mage, a Spell Blade, a Cleric and a Summoner, D310; every node, all three Finals
routes, D312; careful policy chips with weak parts and spends big skills on a Break, attack-only uses free actions;
these rows hold Limit Breaks, and section 15 has the same chapters with them):

| Chapter | Regular fights | Stage sub-bosses | Finals vanguards | Champions (all three) |
|---|---|---|---|---|
| URA (from Lv1) | 5–7 rounds | 7–9 rounds, 5–11% HP lost | 6.7 rounds, 10% lost | 11.3 rounds, 40% lost, at Lv12 |
| Unity Cup (from Lv13) | 3–5 rounds | 5–7 rounds, 0–6% lost | 5 rounds, 4% lost | 8.3 rounds, 23% lost |
| Project L'Arc (T2 Lv11) | 3–4 rounds | 5–6 rounds, 1–7% lost | 4.3 rounds, 2% lost | 7.3 rounds, 15% lost |

A full clear ends at Lv12, Lv24 and T2 Lv22, as the five-route Finals did. With one route (before D312) the party met
its champion two levels lower: URA's took 18 rounds at Lv10.

With six fights a stage (D286) the party stands at the same level at every stage as with ten, and a careful URA clear
takes 23 fights instead of 35 (about 120 sim minutes instead of 180).

Attack-only loses a sub-boss in every chapter. From Unity Cup on, bosses barely hurt a party that spends its whole MP
pool; boss offense is the next lever if they feel safe in play. Bigger boss shields (7/10) were tried and only made
URA's champion a loss.

## 12. Saves and migration

- **Outfits (schema 3):** class, two weapons (main and off), tier, level, EXP, learned nodes `{ tier, id }` (core and
  variants) and legacy; aptitudes and stats as today. Node ids are stable strings such as `greatsword.fire.3` and
  `mage-staff.ice.2b`.
- **Parties (schema 3):** each slot keeps the outfit, its equipped skill ids and the Summoner's Familiar form; the
  signature element is gone.
- **Runs:** an open fight from engine v3 is dropped (no reward, MP as it was); wins and carried MP stay (MP is clamped
  to the new pool).
- **The one-time migration** keeps every Uma's tier, level, EXP, party membership and chapter progress. It assigns
  her class (an ambiguous Uma gets the first of Brawler, Mage, Cleric, Summoner), default weapons (Brawler Greatsword
  + Spear; Mage Mage Staff + Arcane Staff), clears trees, legacy skills and loadouts, and sets every Familiar to
  Greatsword. All points come back, and the empty tree lets her re-pick class and weapons once.
- **The API** validates schema 3 on its own (class mapping, weapon sets, and node ids read as tree, branch, depth and
  side against a tree-branch table), and still accepts schema 2 so an older installed app cannot break sync; an
  older schema never overwrites a newer one.
- **The Spell Blade (D310): outfits and parties move to schema 4.** A schema-3 Mage who carried a Short Sword becomes a
  Spell Blade with an empty tree and no legacy (every point back, class free to change again, tier, level and EXP
  kept); every party stops equipping her old skills; every other outfit and party only changes its schema number.
  Skills a member no longer has are also dropped wherever a party is used or saved, so a party synced from an older
  copy still plays. Battles move to engine v5: a fight left open under v4 closes with no reward and MP as it was.
  The API reads schema 3 by the old class rules and schema 4 by the new ones.

## 13. Decisions

D277 classes, D278 turns and hands, D279 damage and weaknesses, D280 trees, D281 statuses and blessings, D282 schema 3,
engine v4 and the migration, D310 the Spell Blade and schema 4, D311 Limit Breaks (see [the decision log](../decisions.md)).

## 14. Phone presentation

- **Enroll:** her class from her running styles (a choice when they allow several, so a Pace Uma picks Mage or Spell
  Blade), its one-line role and, for a Brawler, the weapon set.
- **Tree screen:** tabs for her two trees, then her three branches; each depth shows the core skill and, below it, the
  fork's two variants. A node shows its kinds, targets, hits, power after her hand and MP, and why it is closed. A
  learned variant offers **Swap out** (refund).
- **Party slot:** class and weapons, the equipped skills (up to her slots) and, for a Summoner, the Familiar form.
- **Limit Break:** no bar on screen; a full charge puts an **LB** badge on her portrait in the party row, and tapping
  it opens her Limit Break menu (section 15). A Summoner picks two summons there, then any Limit Break taps a foe.
- **Fight:** a Brawler picks the weapon above Attack; two-action Umas show "action 1 of 2"; Attack reads Slash (Spell
  Blade), Strike or Familiar by build; a Cleric with several blessings in a branch picks one after the skill. Weakness icons
  show elements then weapons.

## 15. Limit Breaks

After Final Fantasy's Limit Breaks and Octopath Traveler's Boost (D311): every Uma fills a hidden bar as she fights and,
when it is full, spends it on one big turn.

- **Charge:** an attack (Attack, Slash, Strike or the Familiar) adds 1, a skill 2, to a bar of **12**. Umas who act once
  a turn (Brawler, Cleric) charge double, so every class fills at the same pace a round: three rounds of skills, or six
  of attacks. Guard adds nothing. The bar starts empty each fight, stops at full and waits there until she uses it; it
  starts charging again only after.
- **Use:** before her first action of a round, she spends the full bar on her **whole turn** at **0 MP**, worth about
  twice her usual turn. A foe must be the target.

| Class | Limit Break | Power |
|---|---|---|
| Brawler | Any equipped skill, cast twice in a row (with none equipped: Twin Strike, two full Attacks) | 2 × her skill |
| Mage | **Prismatic Nova**: one foe takes Fire, Ice, Lightning, Light, Dark and Ultima, a hit each | 2.4 × the depth open at her level (four of her casts) |
| Spell Blade | An Elemental Blade skill as **three great hits** of sword and its element; an Arcane Blade skill with **twice the hits**; with none equipped, **Triad Blade** (sword with Fire, Ice and Lightning, a hit each) | 2 × her turn (4 × a cast) |
| Cleric | **Divine Patrons**: her patrons of Light and Dark strike one foe twice, both elements in each hit (no blessing) | 1.5 × the depth open at her level (three of her casts) |
| Summoner | Two summons she picks (the same one twice is fine), each summoned twice | 2 × her turn (four summons) |

- Riders, capstone specials and weaknesses work as in the skills; each Light/Dark part of Divine Patrons can remove a
  shield point. If the foe falls mid-Limit Break, the rest lands on the living foe with the least HP left.
- The Cleric's is the one below 2 × her turn in damage because her blessing is half her turn's value: 1.5 × the
  depth's power is three of her casts, a single-target hit close to a damage class's turn.
- Foes are unchanged (the owner asked for no difficulty rebalance yet). `pnpm sim:rpg:campaign` plays careful (Limit
  Breaks on a Broken foe, or on any foe outside boss fights) beside the same policy holding them:

| Chapter | Champions with / without Limit Breaks | Sub-bosses with / without |
|---|---|---|
| URA (from Lv1) | 6.7 / 11.3 rounds, 15% / 40% HP lost | 6–7 / 7–9 rounds |
| Unity Cup (from Lv13) | 5 / 8.3 rounds | 4–5 / 5–7 rounds |
| Project L'Arc (T2 Lv11) | 5 / 7.3 rounds | 4–5 / 4–6 rounds |

  Every node is played, all three Finals routes included (D312). A champion fight sees about five Limit Breaks
  (one per Uma); regular fights rarely last long enough to fill one. (On the one-route sim before D312, URA's champion
  went from 18 to 10 rounds.)
