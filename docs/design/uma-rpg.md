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
- Each chapter is one scenario and covers twelve levels (D266): URA Finale Lv1–12, Unity Cup Lv13–24 … Tracen Diner
  T4 Lv7–18. Clearing every node (43 battles) ends near the chapter's last level, so four chapters bring a party to
  about Lv48 and the fifth starts with every skill point and slot. One route to a champion is 35 battles.

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
| Skill points | **Two per level up to Lv45, plus five each time a depth opens: 115 per tier** (D264, D265); one point learns a skill or raises one skill level (max 5, +8% power each) |
| Tree cost | An A element has 11 skills (55 points to max), a B element 6 (30). 115 points max **two A trees** (110) or **one A and two B trees** (115) |
| Depth gates | Lv 1 / 10 / 20 / 30 / 40; each depth needs the one above in the same element |
| Skill slots | 3 at Lv1, then one more at Lv 10, 15, 20, 25, 30, 35 and 40: **10 by Lv40** (Attack and Guard are free) |
| Promotion | Keeps stats and banked EXP; archives the tier's tree; up to two legacy skills |

The campaign restarted every enrolled outfit at **Tier 1 Lv1** once (D263): class, weapon, elements and party
membership stayed; learned skills, loadouts and first-map chapter progress were cleared.

## Battles (engine v3, D265)

`packages/domain/src/rpg/battle/` is a pure, seeded reducer: a frozen input (five allies with their carried MP, one to
five foes) plus the action list always replays to the same state and hash. No wall clock or `Math.random`.
The break rules follow Octopath Traveler; D261's Down, One More and All-Out Attack are gone.

- **Turn:** each living Uma acts once a round in any order: **Attack** (free, hits with her weapon), **Skill** (MP,
  hits with its element) or **Guard** (take half of one single-target hit for an ally). Foes act after the last Uma,
  in initiative order. Every foe shows its next move and target before you commit. HP is full at the start of every
  fight; there is **no healing**.
- **Shields and weaknesses:** every foe has a **shield** and is weak to **one element** (Fire > Ice > Lightning > Fire;
  Light ↔ Dark, from its own element) and **two weapon kinds** (three for champions). Weapon kinds are Greatsword,
  Spear, Sword (Sword + shield) and Staff (both staves) and Tome. Each hit on a weakness deals ×1.3 and removes one
  shield point; multi-hit skills chip once per hit. Shields: regular foes 2 (3 from the Senior stage), sub-bosses 4,
  champions 6. The fight screen and the map show the shield number and weakness icons on every foe.
- **Break:** until its shield breaks a foe takes **half damage**. At zero it is **Broken**: it loses that round's and
  the next round's action and takes **full damage**; after the second enemy phase its shield returns. (Octopath's ×2 on
  a broken foe and ×1.3 on a weakness, expressed as half before the break.) Bosses change to stronger moves at 50% HP.
- **Skills:** every technique is an elemental attack. Per-hit power and hits by branch:

  | Depth | Branches |
  |---|---|
  | 1 | Strike 1.6 |
  | 2 | Focus 2.0 · Sweep 1.1 (all foes) · **Twin 2 × 1.05** |
  | 3 | Burst 2.6 · **Triple 3 × 0.95** |
  | 4 | Mastery 3.0 · Storm 1.6 (all foes) · **Quad 4 × 0.85** |
  | 5 | Finale 3.8 · **Barrage 6 × 0.7 on random foes** |

  × weapon (Greatsword 1.15, Spear 1.0, Sword + shield 0.85, Wizard 1.1, Cleric 0.8, Tome 1.1); +8% per skill level.
  Sword + shield skills also Ward the party (−15% damage taken); Cleric skills Power Up the party (+15% damage).
  MP cost is `(6 + 4 × depth + 4 if it hits all) × tier`. Barrage's targets are seeded by the fight, round and actor.
- **Damage:** `power × max(0.2 × offense, offense − 0.5 × defense)`, × 1.3 on a weakness, statuses (burn 4% max HP per
  stack, slow/weaken −15% dealt, mark +10% taken per stack, ward −15% taken, power up +15% dealt), signature, and ×0.5
  while the foe's shield stands.
- A fight lasting 40 rounds is a loss; a simultaneous wipe is a loss. A fight left open under engine v2 is dropped on
  update: no reward, MP as it was when it began.

## Chapters and the map (D262)

`packages/domain/src/rpg/campaign/chapters.ts` generates each scenario's chapter from its tier and the cast. Layout,
levels, elements and stats are code, so a rebalance never needs a content publish; node ids stay stable.

- **Shape (top to bottom, five columns, D266):** a starting camp; three fight stages (Debut, Classic, Senior Year),
  each with four rows of regular fights alternating three and two lanes, a camp and a **sub-boss** squad; then the
  **Finals**: a last camp that splits into **five elemental routes** (Ember, Frost, Storm, Dawn, Dusk), each a
  sub-boss vanguard and then a **champion** of that element, with no regular fights. Pick the route whose champion your
  party can break. 30 regular fights, 8 sub-bosses, 5 champions, 5 camps.
- **Levels:** Debut Lv1–3, Classic 4–6, Senior Year 7–9, Finals 10–12 of the chapter: stage `k` fights at
  `start + 3k` and `+1`, its sub-boss at `start + 3k + 2`; the last camp at `start + 9`, Finals sub-bosses at
  `start + 10`, champions at `start + 11`.
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

- **EXP** to all five entrants (KO'd included): a share of one level at the foes' level (fight 0.25, sub-boss 0.28,
  champion 0.32 of `expToNext`, D266), × `1 − 0.1 × (member level − foe level)` clamped to 0.1–2.0. Outleveled fights
  pay little; fights above you pay up to double. First clears reach the Finals around chapter Lv9, one route ends
  around Lv10 and every node around Lv12 (Lv24, 36 and 48 in the next chapters).
- **Inspiration tokens** of the chapter's scenario: fight 1 Slot + 2 Skill, sub-boss 4 + 8, champion 6 + 12 (D266).
  Clearing every node pays 92 Slot + 184 Skill, enough for fifteen units' parents (6 Slot) and skills (12 Skill).
  Gross tokens first repay the matching Inspiration advance debt (D256), then land in Items.

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
  foes' elements; cleared nodes carry a check or win count. A node sheet shows each foe's portrait, element, shield,
  weakness icons, HP and moves, which party members can chip it (by Attack or by skill element), the EXP and tokens,
  and Fight / Fight again / Rest.
- **Fight:** each foe shows HP, an Octopath-style shield badge with its count, weakness icons (element, then weapon
  kinds) and its intent; the selected action's projected damage on every foe, marked WEAK and with the shield points it
  removes or BREAK; five party cards with HP and MP. Tap a foe to attack, or pick a skill first. BREAK is called out
  large. The result settles itself: EXP, level-ups, skill points and tokens.
- Main JS stays ≤ 180 KB gzip; every RPG screen is a lazy chunk.

## Tuning

`pnpm sim:rpg:campaign [scenarioId]` plays a synthetic party (invented outfits and cast) through a chapter with a
careful policy (weakness skills, one skill per Uma in regular fights, rest below 35% MP) and an attack-only policy.
At this pin (D266, careful policy: chip with weak Attacks and multi-hit skills, spend big skills on a Break), careful
play of one route reaches the Finals at chapter Lv9 and clears URA, Unity Cup and Project L'Arc. The URA champion (Lv12
against a Lv10 party) takes a retry or two; a full clear meets it about a level higher. Attack-only loses a Senior or
Finals sub-boss. Change numbers here and in the tests together.

## Relationship to other systems

The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars. Its tokens fund
[Inspiration](skills-and-inheritance.md#lineage) slots and golds. The private pack (see the
[content contract](../technical/rpg-chapter-content.md)) supplies only the cast: names and verified portraits.
Original-game and PriConne content stays private.
