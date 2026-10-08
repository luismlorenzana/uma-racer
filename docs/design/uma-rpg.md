# Global Uma RPG — design

> **Status: the campaign (D260–D266) with classes (D277–D282).** One generated chapter per scenario, a top-to-bottom
> map you can replay, four classes with authored skill trees, Octopath-style break battles, MP carried between fights,
> and every win paying EXP and Inspiration tokens. RPG progress saves on the phone first and syncs in the background
> like races and the Farm. Every tree, node and number is in [the class trees](uma-rpg-classes.md).
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

## Roster and classes (D277)

- An owned outfit with an **A running style** can enroll. Her A styles pick the class: Front or Front + Pace →
  **Brawler**; Pace or Pace + Late → **Mage**; Late → **Cleric**; End or Late + End → **Summoner**. Any other mix
  chooses among its single styles' classes.
- Brawlers enroll with Greatsword + Spear or Axe + Bow; Mages with any two of Mage Staff, Arcane Staff and Short
  Sword; Clerics carry Arcane + Cleric Staff; Summoners a Summoner Tome. Class and weapons change freely while she has
  no learned skills.
- Each class leans the shared stats (Brawler HP and ATK up, Mage M.ATK and MP up, Cleric M.DEF and MP up). Distance
  aptitudes, element affinities and the +10% signature element are retired.
- Enrollment freezes the outfit's base stats, growths and aptitudes. RPG stats never read Training or races.
- A party slot equips learned skills up to the slot count and, for a Summoner, picks the Familiar's weapon form. An
  outfit belongs to one party at a time; adding it to another party moves it (D263).

## Progression

| Measure | Rule |
|---|---|
| Levels | Tier-local Lv1–50, EXP to next `120 + 16L`; Lv50 banks EXP until a manual **promotion** to the next tier. Lifetime level = `50 × (tier − 1) + level`. |
| Core stats | `round(base / 5 + n × 1.5 × (1 + growth))`, `n` = lifetime level − 1 |
| Combat stats | ATK = MATK = Speed; Speed (initiative) = Stamina; DEF = Power; M.DEF = (Power + Wit) / 2; HP = 100 + 6 × Stamina + 2 × Power; **MP = 20 + 1.5 × Wit** (D261); each × the class lean (D277) |
| Skill points | **Two per level up to Lv45, plus five each time a depth opens: 115 per tier** (D264); no skill levels (D280) |
| Tree cost | Two trees of three branches per class. A node costs its depth: every core node is 90 points, learned by Lv40. Variant forks (one side, three per tree, swappable) take up to 24 more by Lv45 |
| Depth gates | Lv 1 / 10 / 20 / 30 / 40; a core node needs the one above it, a variant needs its core node |
| Skill slots | 3 at Lv1, then one more at Lv 10, 15, 20, 25, 30, 35 and 40: **10 by Lv40** (Attack and Guard are free) |
| Promotion | Keeps stats and banked EXP; archives the tier's tree; up to two legacy skills |

The campaign restarted every enrolled outfit at **Tier 1 Lv1** once (D263). Classes (D282) kept every tier, level, EXP
and party, gave each Uma her class, and cleared trees and loadouts once; every point came back.

## Battles (engine v4, D278–D281)

`packages/domain/src/rpg/battle/` is a pure, seeded reducer: a frozen input (five allies with their carried MP, one to
five foes) plus the action list always replays to the same state and hash. No wall clock or `Math.random`. The break
rules follow Octopath Traveler; the full rules and numbers are in [the class trees](uma-rpg-classes.md).

- **Turn:** a Brawler acts once (Attack with either weapon, a skill or Guard); a Mage with two staves casts twice; a
  Mage with a Short Sword casts once and the sword follows every spell; a Cleric's cast carries a blessing; a Summoner
  summons twice and her Familiar attacks free once a round. Guard ends her turn. Foes act after the last action, in
  initiative order, and show their next move. HP is full at the start of every fight; only the Cleric heals, a little.
- **Hits and weaknesses:** a hit has one to three parts (a Greatsword hit is 75% Greatsword + 25% element). Foes are
  weak to some of five weapon kinds (Greatsword, Spear, Axe, Bow, Short Sword) and five elements (Fire, Ice, Lightning,
  Light, Dark): regulars 3 + 2 or 2 + 3, sub-bosses 2 + 2, champions 2 + 1 or 1 + 2, never their own element. Each weak
  part deals ×1.3 and removes a shield point. Ultima deals ×1.2 and is never a weakness. Shields: regular foes 2 (3
  from Senior Year), sub-bosses 6, champions 8.
- **Break:** until its shield breaks a foe takes **half damage**. At zero it is **Broken**: it loses that round's and
  the next round's action and takes **full damage**; after the second enemy phase its shield returns. Bosses change to
  stronger moves at 50% HP.
- **Skills:** single-target power 1.6 / 2.2 / 2.9 / 3.7 / 4.6 by depth, × the hand (Brawler 1.0, two staves 0.6 each,
  staff + sword 0.75, Cleric 0.5, Summoner 0.5 each); every-foe skills 55% per foe; random multi-hits ×1.05. MP is
  `(6 + 4 × depth, +4 for every foe) × hand × tier`.
- **Statuses:** Brave, Faith, Breaker, Barrier, Regen, Aegis on allies; Armor Break, Mind Break, Enfeeble, Shock, Burn,
  Hex on foes; capstones and some variants carry Fire → Burn, Ice → Chill, Lightning → Shock.
- A fight lasting 40 rounds is a loss; a simultaneous wipe is a loss. A fight left open under an older engine is
  dropped on update: no reward, MP as it was when it began.

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
  toward one element so a party can steer by its weaknesses. Sub-bosses bring 1–2 regular minions, champions 2.
  Leaders rotate through the cast. Stats scale with level from an average enrolled outfit's stat
  `22 + 1.59 × (level − 1)`: HP `(40 + 4.2s) × role` (× 4.5 sub-boss, × 6.5 champion, both × the chapter's skill reach,
  D282), offense `3s × role`, defense `0.8s × role`.
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

## Saving and sync (D260, D263, D282)

- Every RPG change commits to Dexie with its outbox markers in one transaction and syncs through the ordinary
  `/api/sync`: enrollment, parties, skills, promotion, runs, results (`rpgResults` schema 2), Items and ledger.
  Inspiration unlocks in Training are ordinary writes too. Nothing waits on the server; there is no Sync or Submit step.
- Outfits and parties are schema 3 (D282); runs and results stay schema 2. The server checks schema-3 outfits against
  the class and tree rules, still accepts schema-2 outfits and parties from an older installed app, refuses schema-1 RPG
  rows and `rpgReceipts` in ordinary sync, and refuses an older RPG schema over a newer one. The Inspiration bank may only move toward zero through sync.
  `/api/rpg/command` now accepts only `spend-inspiration` from older app versions.
- Root fix (D260): `gameRuntime.schedule()` always arms a sync (the outbox is the truth, not the store's pending
  count), and `flush()` callers share an in-flight sync instead of returning early.

## Phone presentation

- **Parties:** five cards (members, level, current chapter progress, Edit). **Roster:** five icons per row, enrolled
  first. **Profile:** enroll as her class (and weapon set); stats; the tree screen (two tree tabs, three branch tabs,
  each core skill with its fork of two variants, Learn and Swap out). **Edit party:** slot pickers, skill chips and the
  Summoner's Familiar form; every change saves.
- **Chapters:** scenario crest, chapter number, level band and progress for all fourteen.
- **Map:** party MP bar, then the node graph with branch lines (solid once open), each node showing kind, level and its
  foes' elements; cleared nodes carry a check or win count. A node sheet shows each foe's portrait, element, shield,
  weakness icons, HP and moves, which party members can chip it and with which kinds, the EXP and tokens,
  and Fight / Fight again / Rest.
- **Fight:** each foe shows HP, an Octopath-style shield badge with its count, weakness icons (elements, then weapon
  kinds) and its intent; the selected action's projected damage on every foe, marked WEAK and with the shield points it
  removes or BREAK; five party cards with HP, MP and actions left. Tap a foe to attack, or pick a skill first; a
  Brawler picks her weapon above Attack, and a Cleric picks the blessing after the skill. BREAK is called out large.
  The result settles itself: EXP, level-ups, skill points and tokens.
- Main JS stays ≤ 180 KB gzip; every RPG screen is a lazy chunk.

## Tuning

`pnpm sim:rpg:campaign [scenarioId]` plays a synthetic party (one Brawler, two Mages, a Cleric and a Summoner; invented
outfits and cast) through one route of a chapter with a careful policy (chip with weak parts, spend big skills on a
Break, rest below 35% MP) and an attack-only policy. At this pin (D282) careful play reaches the Finals at chapter Lv9
and clears URA, Unity Cup and Project L'Arc: regular fights 3–8 rounds, sub-bosses 4–9, champions 7–8 rounds (URA's
17, at Lv10 against Lv12). Attack-only loses a sub-boss in every chapter. Results by chapter are in
[the class trees](uma-rpg-classes.md#11-foes-and-the-campaign). Change numbers there and in the tests together.

## Relationship to other systems

The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars. Its tokens fund
[Inspiration](skills-and-inheritance.md#lineage) slots and golds. The private pack (see the
[content contract](../technical/rpg-chapter-content.md)) supplies only the cast: names and verified portraits.
Original-game and PriConne content stays private.
