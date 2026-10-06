# Global Uma RPG — design

> **Status: the campaign (D260–D263).** One generated chapter per scenario, a top-to-bottom map you can replay,
> Persona-style weakness battles with break shields, MP carried between fights, and every win paying EXP and
> Inspiration tokens. RPG progress saves on the phone first and syncs in the background like races and the Farm.
> This replaces the first chapter map (T095–T099), its server-acknowledged commands and its URA-only content
> (D223, D228, D245–D248 for RPG progress); their history stays in git and the decision log.

The RPG is a self-contained account activity reached from Home. It uses owned Uma **outfits** as a persistent roster,
five saved parties and turn-based battles against a PriConne cast. Its progression is independent of race Uma Level,
Training Level, Farming Level and card stars; its only outward reward is scenario Inspiration tokens in global Items.

## The loop

```text
Home → Uma RPG (Parties) → a party → Chapters (launch pad, one per scenario)
     → the chapter map → tap a node → preview → Fight → result (saved at once) → back to the map
```

- **Parties** lists the five parties; **Roster** lists owned outfits. Every RPG page shares one frame: back, title and
  the guide (?) in the header, content below, no footer links (D260).
- A party must fill all five slots to enter a chapter. Any party may enter any chapter; the launch pad says when a
  chapter is above the party's level.
- Each chapter is one scenario and covers ten levels: URA Finale Lv1–10, Unity Cup Lv11–20 … Tracen Diner T3 Lv31–40.
  A full clear of one route is about 47 fights, roughly 1–2 hours of play, and about ten levels for the party.

## Roster, classes and elements

Settled by D226, D227 and D259; unchanged by the campaign.

- An owned outfit with an **A running style** can enroll. Its class comes from that style and is locked from Lv2:
  Front → Greatsword; Pace → Spear or Sword + shield; Late → Wizard or Cleric staff; End → Tome. Class and weapon
  can change freely while Tier 1 Lv1 with no learned skills.
- Distance aptitudes give elements: Sprint → Dark/Light, Mile → Ice/Light, Medium → Fire/Dark, Long → Lightning/Light.
  An A distance opens all five tree depths for its elements; B stops at depth 3. Surface aptitude does not matter.
- Enrollment freezes the outfit's base stats, growths and aptitudes. RPG stats never read Training or races.
- A party slot picks the member's **signature** element (any eligible one) and equips learned skills up to the slot
  count. A matching-element technique gains 10%. An outfit belongs to one party at a time; adding it to another
  party moves it (D263).

## Progression

| Measure | Rule |
|---|---|
| Levels | Tier-local Lv1–50, EXP to next `120 + 16L`; Lv50 banks EXP until a manual **promotion** to the next tier. Lifetime level = `50 × (tier − 1) + level`. |
| Core stats | `round(base / 5 + n × 1.5 × (1 + growth))`, `n` = lifetime level − 1 |
| Combat stats | ATK = MATK = Speed; Speed (initiative) = Stamina; DEF = Power; M.DEF = (Power + Wit) / 2; HP = 100 + 6 × Stamina + 2 × Power; **MP = 20 + 1.5 × Wit** (D261) |
| Skill points | **Two per level up to Lv45: 90 per tier** (D264); one point learns a skill or raises one skill level (max 5, +8% power each) |
| Tree cost | An A element has 8 skills (40 points to max), a B element 5 (25). 90 points max **two A trees** (80) or **one A and two B trees** (90) |
| Depth gates | Lv 1 / 10 / 20 / 30 / 40; each depth needs the one above in the same element |
| Skill slots | 3 at Lv1, then one more at Lv 10, 15, 20, 25, 30, 35 and 40: **10 by Lv40** (Attack and Guard are free) |
| Promotion | Keeps stats and banked EXP; archives the tier's tree; up to two legacy skills |

The campaign restarted every enrolled outfit at **Tier 1 Lv1** once (D263): class, weapon, elements and party
membership stayed; learned skills, loadouts and first-map chapter progress were cleared.

## Battles (engine v2, D261)

`packages/domain/src/rpg/battle/` is a pure, seeded reducer: a frozen input (five allies with their carried MP, one to
five foes) plus the action list always replays to the same state and hash. No wall clock or `Math.random`.

- **Turn:** each living Uma acts once a round in any order: **Attack** (free, neutral), **Skill** (MP) or **Guard**
  (take half of one single-target hit for an ally). Foes act after the last Uma, in initiative order. Every foe shows
  its next move and target before you commit. HP is full at the start of every fight; there is **no healing**.
- **Elements:** Fire > Ice > Lightning > Fire; Light and Dark beat each other. A weak hit deals ×1.5, a resisted one
  ×0.5 and applies no status. Both channels are fully elemental: a Greatsword Flame Strike is a physical Fire hit.
- **Down and One More:** a weakness hit on a standing regular foe knocks it **Down** (it loses this round's action and
  stands up after the enemy phase) and gives the attacker **One More** action. A foe already Down grants nothing.
- **All-Out Attack:** when every living foe is Down or Broken, any Uma can trigger it: every living Uma strikes every
  foe at full Attack power, and the party's round ends.
- **Shields and breaks:** sub-bosses carry a 2-point shield, champions 4. While the shield holds they take ×0.4
  damage. Each weakness hit removes a point (Flurry hits twice; Finale removes two). At zero the boss is **Broken**: it
  loses this round's action and takes ×2 damage through your next round, then its shield returns. Bosses are never
  knocked Down. Bosses change to stronger moves at 50% HP.
- **Skills:** every technique is an elemental attack. Power per branch: Strike 1.6, Focus 2.0, Sweep 1.1 (all foes),
  Burst 2.6, Flurry 2 × 1.4, Mastery 3.0, Storm 1.6 (all), Finale 3.8; × weapon (Greatsword 1.15, Spear 1.0,
  Sword + shield 0.85, Wizard 1.1, Cleric 0.8, Tome 1.1); +8% per skill level. Sword + shield skills also Ward the
  party (−15% damage taken); Cleric skills Power Up the party (+15% damage). MP cost is
  `(6 + 4 × depth + 4 if it hits all) × tier`.
- **Damage:** `power × max(0.2 × offense, offense − 0.5 × defense)`, then matchup, statuses (burn 4% max HP per stack,
  slow/weaken −15% dealt, mark +10% taken per stack, ward −15% taken, power up +15% dealt), signature and shield.
- A fight lasting 40 rounds is a loss; a simultaneous wipe is a loss.

## Chapters and the map (D262)

`packages/domain/src/rpg/campaign/chapters.ts` generates each scenario's chapter from its tier and the cast. Layout,
levels, elements and stats are code, so a rebalance never needs a content publish; node ids stay stable.

- **Shape (top to bottom, five columns):** a starting camp; four stages (Debut, Classic, Senior, Finals), each with four
  rows of regular fights alternating three and two lanes, a camp and a **sub-boss** squad; then a last camp that splits
  into **five elemental routes** (Ember, Frost, Storm, Dawn, Dusk), each two fights and a **champion** of that element.
  Pick the route whose champion your party can break. 50 regular fights, 4 sub-bosses, 5 champions, 6 camps.
- **Levels:** stage `k` fights at `start + 2k` and `+1`, its sub-boss at `start + 2k + 2`; routes at `start + 9`,
  champions at `start + 10`.
- **Foes:** 2–3 per fight (3 later), cast members in four roles (striker, caster, guard, skirmisher). Side lanes lean
  toward one element so a party can steer by its affinities. Sub-bosses bring 1–2 regular minions, champions 2.
  Leaders rotate through the cast. Stats scale with level from an average enrolled outfit's stat
  `22 + 1.59 × (level − 1)`: HP `(50 + 5s) × role` (× 5 sub-boss, × 8 champion), offense `3s × role`, defense `0.8s × role`.
- **Map rules:** clearing a node opens the nodes below it; any cleared fight can be **replayed** any number of times.
  A champion win marks the chapter cleared; the other four stay optional.

## Runs, MP and camps (D263)

A party's run of a chapter is one synced row (`rpgCheckpoints`, schema 2): wins per node, MP carried per outfit, and
the open fight's frozen input. The fight's action journal is device-local (`rpgFights`); a lost journal replays the
same frozen fight from its first action.

- **MP carries** between fights, including replays. Tapping any **camp** you have reached rests the party: every MP
  refills. HP never carries.
- **Losing or giving up** costs nothing: no reward, and MP returns to what it was when the fight began. Retry freely.
- Leaving a fight keeps it open; the map offers **Resume fight**.

## Rewards (D263)

Every won fight pays, first clear or replay:

- **EXP** to all five entrants (KO'd included): a share of one level at the foes' level (fight 0.14, sub-boss 0.45,
  champion 0.8 of `expToNext`), × `1 − 0.1 × (member level − foe level)` clamped to 0.1–2.0. Outleveled fights pay
  little; fights above you pay up to double.
- **Inspiration tokens** of the chapter's scenario: fight 1 Slot + 2 Skill, sub-boss 3 + 6, champion 6 + 12. Gross
  tokens first repay the matching Inspiration advance debt (D256), then land in Items.

## Saving and sync (D260, D263)

- Every RPG change commits to Dexie with its outbox markers in one transaction and syncs through the ordinary
  `/api/sync`: enrollment, parties, skills, promotion, runs, results (`rpgResults` schema 2), Items and ledger.
  Inspiration unlocks in Training are ordinary writes too. Nothing waits on the server; there is no Sync or Submit step.
- The server accepts schema-2 RPG rows and `rpgPromotions`; it refuses schema-1 RPG rows and `rpgReceipts` in ordinary
  sync, and refuses an older RPG schema over a newer one. The Inspiration bank may only move toward zero through sync.
  `/api/rpg/command` now accepts only `spend-inspiration` from older app versions.
- Root fix (D260): `gameRuntime.schedule()` always arms a sync (the outbox is the truth, not the store's pending
  count), and `flush()` callers share an in-flight sync instead of returning early.

## Phone presentation

- **Parties:** five cards (members, level, current chapter progress, Edit). **Roster:** five icons per row, enrolled
  first. **Profile:** enroll in one tap; stats; skill tree per element with Learn/Level up. **Edit party:** slot
  pickers, signature chips and skill chips; every change saves.
- **Chapters:** scenario crest, chapter number, level band and progress for all fourteen.
- **Map:** party MP bar, then the node graph with branch lines (solid once open), each node showing kind, level and its
  foes' elements; cleared nodes carry a check or win count. A node sheet shows each foe's portrait, element, weakness,
  HP, shield and moves, which party members can hit the weakness, the EXP and tokens, and Fight / Fight again / Rest.
- **Fight:** foes with HP, shield pips, weakness and intent; the selected action's projected damage on every foe
  (WEAK / resist); five party cards with HP and MP. Tap a foe to attack, or pick a skill first. ONE MORE, DOWN, BROKEN
  and ALL-OUT are called out large. The result settles itself: EXP, level-ups, skill points and tokens.
- Main JS stays ≤ 180 KB gzip; every RPG screen is a lazy chunk.

## Tuning

`pnpm sim:rpg:campaign [scenarioId]` plays a synthetic party (invented outfits and cast) through a chapter with a
careful policy (weakness skills, one skill per Uma in regular fights, rest below 35% MP) and an attack-only policy.
At this pin, careful play clears URA, Unity Cup and Project L'Arc: regular fights 2–4 rounds, sub-bosses 3–8 rounds
with up to 45% party HP lost, champions 9–13 rounds with 50–77% lost. Attack-only loses the first sub-boss every time. Change numbers here and in the tests together.

## Relationship to other systems

The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars. Its tokens fund
[Inspiration](skills-and-inheritance.md#lineage) slots and golds. The private pack (see the
[content contract](../technical/rpg-chapter-content.md)) supplies only the cast: names and verified portraits.
Original-game and PriConne content stays private.
