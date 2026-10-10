# Global Uma RPG — design

> **Status: the campaign (D260–D266, Finals D312) with classes (D277–D282, D310).** One generated chapter per scenario, a top-to-bottom
> map you can replay, five classes with authored skill trees, Octopath-style break battles, MP carried between fights,
> and every win paying EXP and Inspiration tokens. RPG progress saves on the phone first and syncs in the background
> like races and the Farm. Every tree, node and number is in [the class trees](uma-rpg-classes.md).
> This replaces the first chapter map (T095–T099), its server-acknowledged commands and its URA-only content
> (D223, D228, D245–D248 for RPG progress); their history stays in git and the decision log.

The RPG is a self-contained account activity reached from Home. It uses owned Uma **outfits** as a persistent roster,
ten saved parties (D284) and turn-based battles against a PriConne cast. Its progression is independent of race Uma Level,
Training Level, Farming Level and card stars; its only outward reward is scenario Inspiration tokens in global Items.

## The loop

```text
Home → Uma RPG (Parties) → a party → Chapters (launch pad, one per scenario)
     → the chapter map → tap a node → preview → Fight → result (saved at once) → back to the map
```

- **Parties** lists the ten parties; **Roster** lists owned outfits. Every RPG page shares one frame: back, title and
  the guide (?) in the header, content below, no footer links (D260).
- A party must fill all five slots to enter a chapter. Any party may enter any chapter; the launch pad says when a
  chapter is above the party's level.
- Each chapter is one scenario and covers twelve levels (D266): URA Finale Lv1–12, Unity Cup Lv13–24 … Tracen Diner
  T4 Lv7–18. Clearing every node (27 battles, D312) ends near the chapter's last level, so four chapters bring a party
  to about Lv48 and the fifth starts with every skill point and slot.

## Roster and classes (D277)

- An owned outfit with an **A running style** can enroll. Her A styles pick the class: Front or Front + Pace →
  **Brawler**; Pace or Pace + Late → **Mage** or **Spell Blade** (her choice, D310); Late → **Cleric**; End or Late +
  End → **Summoner**. Any other mix chooses among its single styles' classes.
- Brawlers enroll with Greatsword + Spear or Axe + Bow; Mages carry a Mage Staff + Arcane Staff; Spell Blades a Short
  Sword; Clerics Arcane + Cleric Staff; Summoners a Summoner Tome. Class and weapons change freely while she has no
  learned skills.
- Each class leans the shared stats (Brawler HP and ATK up, Mage M.ATK and MP up, Spell Blade both offenses a little
  up, Cleric M.DEF and MP up). Distance
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

## Battles (engine v5, D278–D281, D310, D311)

`packages/domain/src/rpg/battle/` is a pure, seeded reducer: a frozen input (five allies with their carried MP, one to
five foes) plus the action list always replays to the same state and hash. No wall clock or `Math.random`. The break
rules follow Octopath Traveler; the full rules and numbers are in [the class trees](uma-rpg-classes.md).

- **Turn:** a Brawler acts once (Attack with either weapon, a skill or Guard); a Mage casts twice; a Spell Blade acts
  twice at half strength (Slash or a blade skill); a Cleric's cast carries a blessing; a Summoner summons twice and her
  Familiar attacks free once a round. Guard ends her turn. Foes act after the last action, in
  initiative order, and show their next move. HP is full at the start of every fight; only the Cleric heals, a little.
- **Hits and weaknesses:** a hit has one to three parts (a Greatsword hit is 75% Greatsword + 25% element). Foes are
  weak to some of five weapon kinds (Greatsword, Spear, Axe, Bow, Short Sword) and five elements (Fire, Ice, Lightning,
  Light, Dark): regulars 3 + 2 or 2 + 3, sub-bosses 2 + 2, champions 2 + 1 or 1 + 2, never their own element. Each weak
  part deals ×1.3 and removes a shield point. Ultima deals ×1.2 and is never a weakness. Shields: regular foes 2 (3
  from Senior Year), sub-bosses 6, champions 8.
- **Break:** until its shield breaks a foe takes **half damage**. At zero it is **Broken**: it loses that round's and
  the next round's action and takes **full damage**; after the second enemy phase its shield returns. Bosses change to
  stronger moves at 50% HP.
- **Skills:** single-target power 1.6 / 2.2 / 2.9 / 3.7 / 4.6 by depth, × the hand (Brawler 1.0, Mage 0.6 each,
  Spell Blade 0.5 each, Cleric 0.5, Summoner 0.5 each); every-foe skills 55% per foe; random multi-hits ×1.05. MP is
  `(6 + 4 × depth, +4 for every foe) × hand × tier`.
- **Limit Break (D311):** an attack charges 1 and a skill 2 (doubled for one-action classes) toward a bar of 12; when
  full, an LB badge on her portrait opens her Limit Break, her whole turn at about twice the damage and 0 MP: a
  Brawler's skill twice, a Mage's Prismatic Nova (five elements and Ultima), a Spell Blade's skill made big, a Cleric's
  Divine Patrons (Light and Dark), a Summoner's two summons twice each. It waits until used and resets each fight.
- **Statuses:** Brave, Faith, Breaker, Barrier, Regen, Aegis on allies; Armor Break, Mind Break, Enfeeble, Shock, Burn,
  Hex on foes; capstones and some variants carry Fire → Burn, Ice → Chill, Lightning → Shock.
- A fight lasting 40 rounds is a loss; a simultaneous wipe is a loss. A fight left open under an older engine is
  dropped on update: no reward, MP as it was when it began.

## Chapters and the map (D262)

`packages/domain/src/rpg/campaign/chapters.ts` generates each scenario's chapter from its tier and the cast. Layout,
levels, elements and stats are code, so a rebalance never needs a content publish; node ids stay stable.

- **Shape (top to bottom, five columns, D266):** a starting camp; three fight stages (Debut, Classic, Senior Year),
  each with two rows of three regular fights (one row per level, D286), a camp and a **sub-boss** squad; then the
  **Finals**: a last camp that splits into the scenario's **three authored routes** (D312), each a **vanguard** (a
  sub-boss) and then a **champion**, with no regular fights. 18 regular fights, 6 sub-bosses (3 stage, 3 vanguards),
  3 champions, 5 camps; see [The Finals](#the-finals-d312).
- **Levels:** Debut Lv1–3, Classic 4–6, Senior Year 7–9, Finals 10–12 of the chapter: stage `k` fights at
  `start + 3k` and `+1`, its sub-boss at `start + 3k + 2`; the last camp at `start + 9`, Finals sub-bosses at
  `start + 10`, champions at `start + 11`.
- **Foes:** 2–3 per fight (3 later), cast members in four roles (striker, caster, guard, skirmisher). Side lanes lean
  toward one element so a party can steer by its weaknesses. Sub-bosses bring 1–2 regular minions, champions 2.
  Leaders rotate through the cast. Stats scale with level from an average enrolled outfit's stat
  `22 + 1.59 × (level − 1)`: HP `(40 + 4.2s) × role` (× 4.5 sub-boss, × 6.5 champion, both × the chapter's skill reach,
  D282), offense `3s × role`, defense `0.8s × role`.
- **Map rules:** clearing a node opens the nodes below it; any cleared fight can be **replayed** any number of times.
  A champion win marks the chapter cleared; the other two routes stay optional but pay as much.

## The Finals (D312)

Every scenario's Finals is authored: a title, three named routes with a one-line flavor shown on the node sheet, and
for each route a vanguard and a champion with their elements and their two escorts (role and element). The three
champions of a scenario always differ in element, and across the fourteen scenarios each element leads seven to ten
of the forty-two routes. A vanguard may share her champion's element, so one answer clears the route, or not, so it
needs two. Weaknesses still come from the seed (a champion's first element weakness is the one that beats her own),
and leaders still rotate through the private cast. Node ids are `route1-sub` … `route3-boss`; the code is
`packages/domain/src/rpg/campaign/finals.ts`.

| Scenario | Finals | Routes: vanguard → champion (escorts) |
|---|---|---|
| URA Finale | URA Finals | **Sprint Final**: Lightning (Lightning skirmisher, Fire striker) → Fire (Fire skirmisher, Lightning striker)<br>**Mile Final**: Ice (Ice caster, Light guard) → Light (Light caster, Ice striker)<br>**Long-Distance Final**: Dark (Dark guard, Ice caster) → Ice (Ice guard, Dark caster) |
| Unity Cup | Unity Cup Final | **Team Blaze**: Fire (Fire striker, Lightning striker) → Fire (Fire striker, Lightning caster)<br>**Team Glacier**: Ice (Ice guard, Ice caster) → Ice (Dark guard, Ice caster)<br>**Team Eclipse**: Light (Light caster, Dark skirmisher) → Dark (Dark skirmisher, Light caster) |
| Trackblazer | Climax Races | **Spring Climax**: Light (Light skirmisher, Lightning striker) → Lightning (Lightning skirmisher, Light skirmisher)<br>**Summer Climax**: Lightning (Lightning striker, Fire caster) → Fire (Fire striker, Ice guard)<br>**Winter Climax**: Ice (Ice guard, Dark caster) → Dark (Dark caster, Ice guard) |
| Our Grand Concert | Grand Live | **Opening Act**: Lightning (Lightning skirmisher, Fire caster) → Lightning (Lightning skirmisher, Light striker)<br>**Encore Stage**: Light (Light caster, Lightning caster) → Light (Light caster, Dark guard)<br>**Midnight Live**: Dark (Dark skirmisher, Fire striker) → Dark (Dark striker, Ice caster) |
| Grand Masters | Trials of the Masters | **Trial of Radiance**: Light (Light guard, Ice caster) → Light (Light caster, Fire guard)<br>**Trial of Shadow**: Dark (Dark skirmisher, Lightning skirmisher) → Dark (Dark skirmisher, Dark caster)<br>**Trial of Flame**: Ice (Ice striker, Fire caster) → Fire (Fire striker, Fire striker) |
| Project L'Arc | Arc Weekend | **Longchamp Straight**: Lightning (Lightning skirmisher, Light striker) → Light (Light striker, Lightning skirmisher)<br>**Paris by Night**: Dark (Dark caster, Ice skirmisher) → Dark (Dark caster, Light guard)<br>**Autumn Rain**: Ice (Ice guard, Lightning caster) → Ice (Ice guard, Dark striker) |
| U.A.F. Ready GO! | U.A.F. Finals | **Red Division**: Fire (Fire striker, Fire skirmisher) → Fire (Fire striker, Lightning guard)<br>**Blue Division**: Ice (Ice skirmisher, Ice caster) → Ice (Ice skirmisher, Light caster)<br>**Yellow Division**: Lightning (Lightning caster, Lightning guard) → Lightning (Lightning caster, Fire skirmisher) |
| Great Food Festival | Festival Showdown | **Grill Masters**: Fire (Fire striker, Lightning caster) → Fire (Fire striker, Fire caster)<br>**Frozen Dessert Bar**: Ice (Ice caster, Light guard) → Ice (Ice caster, Light caster)<br>**Midnight Feast**: Dark (Dark skirmisher, Fire striker) → Dark (Dark guard, Fire striker) |
| Run! Mecha Umamusume | Mecha Grand Prix | **Reactor Core**: Fire (Lightning guard, Fire caster) → Lightning (Lightning caster, Lightning guard)<br>**Thruster Bay**: Lightning (Fire skirmisher, Lightning skirmisher) → Fire (Fire skirmisher, Lightning striker)<br>**Coolant Plant**: Dark (Ice guard, Dark caster) → Ice (Ice guard, Ice caster) |
| The Twinkle Legends | Legends' Night | **Shooting Star**: Lightning (Light skirmisher, Lightning skirmisher) → Light (Light skirmisher, Lightning caster)<br>**Eclipse**: Light (Light caster, Dark guard) → Dark (Dark caster, Light caster)<br>**Thunderhead**: Ice (Ice striker, Lightning guard) → Lightning (Lightning striker, Ice striker) |
| Design Your Island | Island Trials | **Volcano Peak**: Fire (Fire striker, Fire guard) → Fire (Fire striker, Dark caster)<br>**Coral Caves**: Ice (Ice caster, Lightning skirmisher) → Ice (Ice caster, Light caster)<br>**Monsoon Coast**: Lightning (Lightning skirmisher, Ice striker) → Lightning (Lightning skirmisher, Ice guard) |
| Yukoma Hot Springs | Hot Springs Festival | **Steam Baths**: Fire (Fire caster, Ice guard) → Fire (Fire caster, Fire striker)<br>**Snow Garden**: Ice (Ice guard, Ice striker) → Ice (Ice guard, Light caster)<br>**Lantern Path**: Dark (Dark skirmisher, Light caster) → Light (Light caster, Dark skirmisher) |
| Beyond Dreams | Beyond the Dream | **Toward the Light**: Dark (Dark guard, Dark caster) → Light (Light caster, Light striker)<br>**Shadow of Doubt**: Light (Light skirmisher, Dark striker) → Dark (Dark skirmisher, Dark guard)<br>**Forward Together**: Fire (Fire striker, Lightning skirmisher) → Lightning (Lightning striker, Fire caster) |
| Tracen Diner | Diner Rush | **Kitchen Fire**: Fire (Fire striker, Fire caster) → Fire (Fire striker, Lightning guard)<br>**Cold Noodle Counter**: Ice (Ice caster, Light skirmisher) → Ice (Ice caster, Ice caster)<br>**Morning Prep**: Lightning (Light guard, Lightning skirmisher) → Light (Light guard, Lightning striker) |

- **Carry-over:** wins on the five retired elemental routes (`fire-sub` … `dark-boss`) carry by count: as many routes
  won as champions beaten (up to three), with their vanguards, plus any extra vanguards; nothing new is paid. The
  owner's URA Finale run, whose three champions were beaten, is marked complete (every vanguard and champion won).
  A fight left open on a retired route closes with no reward (or, from an older copy, settles at its foes' level).

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

- **EXP** to all five entrants (KO'd included): a share of one level at the foes' level (fight 0.42, stage sub-boss
  0.28, Finals vanguard 0.47, champion 0.53 of `expToNext`, D266, D286, D312), × `1 − 0.1 × (member level − foe level)`
  clamped to 0.1–2.0. Outleveled fights pay little; fights above you pay up to double. Three routes pay what five did
  (5/3 each), so first clears reach the Finals around chapter Lv9 and every node ends around Lv12 (Lv24, 36 and 48 in
  the next chapters), as before.
- **Inspiration tokens** of the chapter's scenario: fight 2 Slot + 4 Skill, stage sub-boss 4 + 8, vanguard 7 + 14,
  champion 10 + 20 (D266, D286, D312). Clearing every node pays 99 Slot + 198 Skill (the five routes' 50 + 100 can't
  split evenly over three, so one Slot and two Skill more), enough for sixteen units' parents (6 Slot) and skills
  (12 Skill).
  Gross tokens first repay the matching Inspiration advance debt (D256), then land in Items.

## Inventory and Convert (D309)

Two more tabs beside Parties and Roster, borrowed from Uma Puzzles' Items and Exchange:

- **Inventory** lists every scenario's Inspiration tokens (Slot and Skill) in Items, owned scenarios first (or all
  fourteen). While the Inspiration advance (D256) is still owed, a card above shows how much of it each kind has repaid
  (`repaid of lent`, summed over scenarios), and each scenario row names what it still owes. Tapping a row opens Convert
  on that scenario.
- **Convert** trades tokens of one kind between neighbouring scenarios: **two of a scenario make one of the next**, and
  **one makes two of the scenario before**, in batches. The input must be in Items. The output repays its own
  scenario's advance first, like an RPG reward, and only the rest lands in Items (repaid output can't be converted
  back); the screen shows the split before you confirm. Conversions wait while the advance is still opening.
- Each conversion writes two `itemLedger` rows, `inspiration-exchange:{id}:in` and `:out`, whose source carries the
  whole exchange (direction, batches, side, kind and tier, and the output's `debtPaid`), so the server checks each row
  on its own; the two stacks and the bank change in the same Dexie transaction and sync like any other Items change.

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

- **Tabs:** Parties, Roster, Inventory and Convert (D309).
- **Parties:** ten cards (members, level, current chapter progress, Edit). **Roster:** five icons per row, enrolled
  first and highest RPG level first (D284). **Profile:** enroll as her class (and weapon set); class with her weapon
  icons; stats; the tree screen (two tree tabs, three branch tabs, each core skill with its fork of two variants, Learn
  and Swap out). Opened from a party, the profile shows that party's members in a strip, one tap apart, and its back
  button returns to the party. **Edit party:** each slot shows its member (tap for her profile and trees), **Add** or
  **Swap** opens a sheet of enrolled Umas that no party holds yet (highest level first), and **Remove** empties the
  slot; skill chips and the Summoner's Familiar form; every change saves.
- **Weapon icons:** each weapon has its own silhouette, colored by family: Brawler weapons red, Mage Staff and Short
  Sword green, Arcane Staff yellow, Cleric Staff blue, Summoner Tome purple. A portrait shows both of a pair's weapons
  side by side.
- **Chapters:** scenario crest, chapter number, level band and progress for all fourteen.
- **Map:** party MP bar, then the node graph with branch lines (solid once open), each node showing kind, level and its
  foes' elements; cleared nodes carry a check or win count. A node sheet shows each foe's portrait, element, shield,
  weakness icons, HP and moves, which party members can chip it and with which kinds, the EXP and tokens,
  and Fight / Fight again / Rest.
- **Fight:** each foe shows HP, an Octopath-style shield badge with its count, weakness icons (elements, then weapon
  kinds) and its intent; the selected action's projected damage on every foe, marked WEAK and with the shield points it
  removes or BREAK; five party cards with HP, MP and actions left. Tap a foe to attack, or pick a skill first; a
  Brawler picks her weapon above Attack, and a Cleric picks the blessing after the skill. BREAK is called out large.
  A full Limit Break shows an LB badge on her portrait. The result settles itself: EXP, level-ups, skill points and tokens.
- Main JS stays ≤ 180 KB gzip; every RPG screen is a lazy chunk.

## Tuning

`pnpm sim:rpg:campaign [scenarioId]` plays a synthetic party (a Brawler, a Mage, a Spell Blade, a Cleric and a Summoner; invented
outfits and cast) through every node of a chapter, all three Finals routes included (D312), with a careful policy
(chip with weak parts, spend big skills on a Break, Limit Breaks on a Broken foe, rest below 35% MP), the same policy
holding Limit Breaks, and an attack-only policy. Careful play reaches the Finals at chapter Lv9, beats all three
champions in URA, Unity Cup and Project L'Arc and ends at Lv12, Lv24 and T2 Lv22. Attack-only loses a sub-boss in
every chapter. Results by chapter are in [the class trees](uma-rpg-classes.md#11-foes-and-the-campaign). Change
numbers there and in the tests together.

## Relationship to other systems

The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars. Its tokens fund
[Inspiration](skills-and-inheritance.md#lineage) slots and golds. The private pack (see the
[content contract](../technical/rpg-chapter-content.md)) supplies only the cast: names and verified portraits.
Original-game and PriConne content stays private.
