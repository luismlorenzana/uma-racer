# Uma Puzzles — global campaign and Constellation progression

**Status: approved plan (D267–D268); T106–T113 foundations/content code/save/sync/real host/mobile UI implemented (D269–D276). Production gameplay not enabled.**
Prepared against `main` at `892fd37` (D266). The owner approved the first draft's recommendations, replacing its
registration recommendation with the rules below. **Proposal** labels elsewhere now identify the accepted starting
specification, not unanswered owner choices; T106 pins the stat/EXP candidates as an initial executable baseline,
not balance closure. T108 pins generated maps, fixed-reference encounter scaling, reward vectors and modest simulation
evidence below. T110–T111 add capability-off persistence and the real replay host; T112 adds saved setup navigation
and T113 adds touch battles, saved results and illustrated guide/practice. Real private content, material surfaces and
release tuning remain the pinned T109 and T114–T116 work.
Historical element alternatives are not active rules. Existing
[Training](training.md), [Minigames](minigames.md) and [Constellations](constellations.md) remain the shipped contract
until the plan is implemented and safely cut over. Claude's RPG work is outside this change.

## Reading guide

- [The new loop and fixed brief](#1-the-new-loop-and-fixed-brief)
- [Constellation Levels and tickets](#2-constellation-levels-and-tickets)
- [Approved registration, catalogue counts and historical alternatives](#3-element-identity-and-the-catalogue-check)
- [Roster, parties and independent Puzzle Levels](#4-roster-parties-and-puzzle-progression)
- [Board, combat, skills and enemies](#5-the-puzzle-battle)
- [Chapter maps, fight types and rewards](#6-chapters-and-the-farming-loop)
- [Exchange shop and negative ticket bank](#7-the-exchange-shop) · [migration](#8-preserving-existing-progress-and-the-negative-ticket-bank)
- [Phone experience and icons](#9-screens-guides-and-visual-identity)
- [Persistence, content and delivery](#10-implementation-boundaries) · [approval record](#12-owner-review)

Implementation instructions: [M030 delivery sequence](../tasks/M030-uma-puzzles.md) and the
[technical contract](../technical/uma-puzzles-implementation.md). Implement one task to completion at a time;
current training remains active until the verified replacement and protected preservation cutover are ready.

## 1. The new loop and fixed brief

Uma Puzzles is an account-wide puzzle RPG: collect a roster, build five-Uma parties, move orbs to defeat monsters,
raise those outfits' independent Puzzle Levels, and stockpile scenario materials. Spend those materials on a racing
Uma later. The party that earned a ticket does not have to contain the Uma that consumes it.

```text
Home → Uma Puzzles → party → scenario map → puzzle battles
                                │               ├─ Puzzle EXP for the five entrants
                                │               └─ scenario/style CL tickets → debt repayment → global Items
                                └─ saved per-party progress

Profile / Training → choose an unlocked scenario → spend eligible tickets → CL rises → configure Constellation
```

The three global modes have deliberately different products:

| Mode | Its own progression | Material used later |
|---|---|---|
| Stable Farm | Farming Level per outfit; aggregate Farm expansion | Scenario crops for Extra stats |
| Uma RPG | RPG outfit levels, class tiers, skills; party maps | Scenario Inspiration slot/skill tokens |
| **Uma Puzzles** | **Puzzle Level per outfit; party maps** | **Scenario/style Constellation Level-Up Tickets** |

Friendship Training still gives cards global stars. Racing still gives Uma EXP, career accomplishments and scenario
access. None of these EXP tracks substitute for another. Do not turn Uma Puzzles into RPG weapon/class combat or
make a racing build mandatory for its party.

### Owner-fixed requirements

- Remove the training-minigame launch from Uma Profile and Training, including Constellation. They become material
  consumption/configuration surfaces, not puzzle entry points.
- Rename Training Level to **Constellation Level (CL)**: **1–10 for each outfit/scenario**. It governs Constellation,
  not Inspiration or Extra stats. All four distance presets continue sharing this level.
- Every new CL increase uses a ticket. Four style families: **FR / PC / LS / EC**, separately for each scenario.
  Any of an outfit's **A running-style aptitudes** can qualify a ticket.
- Tickets live in global Items and can be saved before the racing Uma reaches their destination scenario.
- Add a shop exchanging **one ticket of the immediately higher scenario for two of the lower**, and the reverse.
- Home opens the global mode. It has its own roster, navigation and **five parties of five Umas**; all five slots
  are filled before entering a battle. Each party can retain its own chapter progress.
- Choose and lock an outfit's Puzzle element during roster registration: non-Dirt-A Front-only/Front+Pace → Light;
  End-only/Late+End → Dark; Pace-only/Late-only/Pace+Late choose Fire/Water/Wood. **Dirt A chooses any of all five**,
  overriding style first. All other non-Dirt-A multi-style combinations choose Fire/Water/Wood, explicitly approved
  for the five uncommon current outfits. Enrollment still requires at least one original A running style.
- Battles give independent Puzzle EXP. Scenario chapters represent roughly **ten Puzzle levels each**, with regular
  mixed-element squads and mono-element bosses that can be selected for material farming.
- Target **six Umas' worth of scenario CL tickets per five-Uma party's scenario progression**.
- Enemy cast/art comes from **Puzzle & Dragons**, privately imported, not from the Uma catalogue or generic monsters.
- Existing earned scenario levels generate a **one-time negative ticket bank**. Later rewards pay matching debt
  before entering spendable inventory. Existing levels are not reset.

### Accepted first-release scope

Keep the strong existing continuous-drag interaction, but replace solo Drive/Resolve circuits with a real party:
shared HP, healing orbs, element-linked attacks, enemy squads, targeted attacks, individual active skills, one leader
passive, boss phases and a persistent map. Start with one element per Uma and a small readable enemy-mechanic set.

**Owner-approved: entry and retries are free.** Do not carry over Spark's one daily Training Ticket cost.
This does not change the current daily grant or scenario-promotion price.

## 2. Constellation Levels and tickets

### Names and boundaries

| Name | Meaning after this rework |
|---|---|
| Uma Level | Racing EXP; unlocks that Uma's next scenario, unchanged |
| Puzzle Level (PL) | Independent global outfit progression inside Uma Puzzles |
| Constellation Level (CL) | Shared level 1–10 of one outfit's scenario Constellation |
| Daily Training Ticket | Existing account currency: +15/day, storage 60; still used by Friendship/promotion |
| CL ticket | Inventory material worth one CL increase, with a scenario and running-style family |

Daily Training Tickets and CL tickets must never share an ambiguous `Tickets` label. Puzzle results do not add racing
EXP, award a race win, satisfy a career goal, grant card stars, buy Extra stats or unlock Inspiration.

### What CL preserves

Retain the existing derived-stat and SP formulas, card quality, caps, scenario buffs and template order. Rename their
level input from TL to CL; do not rebalance them as part of a terminology change.

- CL1 opens the baseline card nodes; CL2–8 open the remaining nodes by the existing breadth-first order.
- **CL9–10 remain useful:** baseline SP, `0.40 × spCap × level / 10`, continues rising after all card nodes have
  opened. The shipped stat projection uses fixed template base stats plus node gains, not an additional level-scaled
  base-stat floor. Preserve that behavior; no new Inspiration gate is attached to these levels.
- Card nodes still provide stats and card skills. The independent Extra stats contribution and independent lineage
  contribution remain in the final racing projection; CL does not buy, reset or gate either system.
- CL10 still earns the existing full-training completion fact. Keep earned badges and historical Spark facts.
- An earlier unlocked scenario remains configurable and can consume its own tickets. A new racing scenario begins at CL1.

One ticket gives **exactly +1 CL**, never random EXP. From CL1 to CL10 takes **nine tickets**:

```text
one fresh scenario unit = 10 − 1 = 9 tickets
six fresh scenario units = 6 × 9 = 54 tickets
five fresh scenario units = 45 tickets; the target leaves 9 tickets for another Uma
```

### Ticket eligibility — accepted contract

Use the outfit template's **original, literal A** running-style grades, frozen from the verified catalogue. Do not use
lineage-improved grades, mutable race defaults or the Puzzle element. This keeps Farming/RPG/Puzzle setups independent
and prevents changing a parent from changing which saved material can be spent. The current catalogue has no S style
grades; support for future source S needs an explicit rule, not an undocumented `>= A` interpretation.

An outfit with Front A and Pace A may spend FR or PC tickets, including a mixture in one confirmed batch. Each ticket
must match the selected scenario. Dirt A affects Puzzle enrollment, not which CL styles it can consume. An owned outfit
can consume only into a scenario it has unlocked through racing; stockpiling/exchanging a later ticket does not unlock
that scenario.

Suggested item vocabulary: `constellation:<scenarioId>:<front|pace|late|end>`. Use stable scenario ids, not labels or
an arithmetic assumption about a fourteen-entry enum. There are **56 item definitions for today's fourteen scenarios**;
new scenarios add four more through the scenario registry. Inventory quantities are nonnegative safe integers with
no new storage cap.

### Spending flow

Profile shows a compact `CL 5/10` row for the selected scenario with **Level up**. Training and Constellation offer
the same sheet, not a second transaction implementation. It lists eligible style stocks, target level, tickets to use,
and a preview of actual nodes opened plus derived stat/SP deltas. Ineligible stocks can be inspected but not selected.

Confirmation re-reads the outfit/scenario revision, eligible grades and each stack. It spends no more than
`10 − CL`, applies all chosen tickets atomically, writes evidence, reconciles completion facts and queues sync.
A matching retry returns the receipt; a stale revision spends nothing. No open racing snapshot may be modified by
the spend. After saving, the result names the real nodes and links to Constellation; CL9/10 explicitly show their
SP benefit when no new nodes open. Never automatically slot cards or spend other materials.

## 3. Element identity and the catalogue check

### Evidence and limits

Read-only aggregation on 2026-10-07 used the ignored local normalized Uma pack `data/umas.447e38dc.json`, in local
manifest `56f02305d0ee`: **268 outfits / 135 characters**, including **25 starter outfits / 25 characters**.
These are catalogue/starter aggregates, **not the current owner's unlocked roster** and not a claim that this local
manifest is today's production publication. No original rows, names, source images, private Spark rivals or account
save were copied or committed. Grade comparisons below are exactly `=== 'A'`.

| A-style combination | All outfits | Without Dirt A |
|---|---:|---:|
| Front only | 27 | 22 |
| Pace only | 72 | 65 |
| Late only | 46 | 44 |
| End only | 13 | 11 |
| Front + Pace | 19 | 15 |
| Pace + Late | 66 | 63 |
| Late + End | 20 | 20 |
| Pace + Late + End | 3 | 3 |
| Pace + End | 1 | 1 |
| Front + Late | 1 | 1 |
| **Total** | **268** | **245** |

**23 outfits have Dirt A** and take its override first. Every current outfit has at least one literal A style; no
outfit has a source S style. A future exception must have a visible unavailable-enrollment reason and importer report,
not an arbitrary element or deletion from the collection.

### Approved registration — owner revision, 2026-10-07

Read **original, literal A** grades, not improved lineage or a mutable default style. Apply these exact-set rules in
order; `Front+Pace` here means those two and no other A running style, as in the original filtered brief:

| Priority | Source condition | Element registration |
|---|---|---|
| 1 | Dirt A, regardless of A-style combination | Choose **Fire, Water, Wood, Light or Dark** |
| 2 | Non-Dirt-A; Front only or Front+Pace | **Light** |
| 3 | Non-Dirt-A; End only or Late+End | **Dark** |
| 4 | Non-Dirt-A; Pace only, Late only or Pace+Late | Choose **Fire, Water or Wood** |
| 5 | Other non-Dirt-A multi-style combination, with at least one A running style | Choose **Fire, Water or Wood** |

The Dirt override includes pure Front/End outfits with Dirt A: they still get all five choices. Registration is one
chosen element, not five simultaneous elements or five leveling tracks. Lock/correction rules in section 4 apply.

| Registration category | All outfits | Starter outfits |
|---|---:|---:|
| Fixed Light | **37** | **5** |
| Fixed Dark | **31** | **1** |
| Basic-element choice (including five multi-style exceptions) | **177** | **18** |
| Dirt-A all-five choice | **23** | **1** |
| **Total** | **268** | **25** |

Compared with the original mapping's 128 fixed Light/Dark outfits, this has **68/268 = 25.4%** fixed Light/Dark.
**200** outfits can choose each basic element; **60** are eligible for Light and **54** for Dark, including
Dirt choices. These eligible pools overlap; they are not final populations and must not be added. Among starters,
each basic element has **19** eligible choices, Light **6**, Dark **2**. No five-colour party quota is introduced.

**Owner-approved exception:** three non-Dirt-A Pace+Late+End outfits, one Pace+End and one Front+Late also choose
Fire/Water/Wood. They account for the increase from 172 to **177** basic-choice outfits. Future other multi-A
combinations follow this same explicit fallback; do not broaden Light/Dark to any Front/End aptitude. An outfit with
no original A running style remains unavailable for enrollment with a visible reason, not silently assigned or removed
from the collection. All current 268 outfits are covered, and no current outfit lacks an A style.

Show owned-roster colour counts during enrollment and suggest an underrepresented eligible colour without selecting
it automatically. **Combat element does not replace source-A running-style eligibility for CL ticket spending.**
The five-element/four-ticket reward map below remains independent and accepted; changing Front registration to Light
does not turn every Light enemy drop into an FR ticket.

### Historical Option A — the owner's original mapping (superseded)

For non-Dirt-A outfits: Front-only/Front+Pace → Fire; End-only/Late+End → Water; Late-only → Wood; Pace-only → Light;
Pace+Late → Dark. Dirt A → choose Fire/Water/Wood.

| Result | All outfits | Starter outfits |
|---|---:|---:|
| Fixed Fire | 37 | 5 |
| Fixed Water | 31 | 1 |
| Fixed Wood | 44 | 5 |
| Fixed Light | 65 | 6 |
| Fixed Dark | 63 | 7 |
| Dirt choice of a basic element | 23 | 1 |
| **Uncovered combinations** | **5** | **0** |
| **Total** | **268** | **25** |

Light/Dark alone occupy **128/268 = 47.8%** before choices. Starters have one fixed Water outfit, and Dirt supplies
only one extra choice. This is workable without a mandatory five-colour party, but creates the scarcity the owner
anticipated. The missing five are the three Pace+Late+End, one Pace+End and one Front+Late outfits.

**Historical proposal if A won:** uncovered multi-A outfits choose any basic element, shown as an explicit exception category.
That makes the basic-choice pool 28, but does not silently rewrite the exact supplied predicates.

### Three historical alternatives — comparison only, not current registration

All three keep Dirt A's basic-element override first and freeze a single selected element at registration.

| Alternative | Rule for non-Dirt-A outfits | Full catalogue partition | Starter partition |
|---|---|---|---|
| **B — broad style anchors** | Any End A → Dark; otherwise any Front A → Light; everyone else chooses Fire/Water/Wood | Light **38**, Dark **35**, basic choice **195** | Light **5**, Dark **1**, basic choice **19** |
| **C — pure specialists, broad basics** | Front-only → Light; End-only → Dark; every other combination chooses Fire/Water/Wood | Light **22**, Dark **11**, basic choice **235** | Light **2**, Dark **1**, basic choice **22** |
| **D — aptitude palette** | Front grants Fire/Light; Pace Fire/Wood; Late Water/Wood; End Water/Dark; choose one from the union of the outfit's A styles | Choice pools overlap; see below | Choice pools overlap; see below |

B has **27.2%** fixed Light/Dark; C has **12.3%**, with **87.7%** available to distribute among the basic triangle.
B's stated End-before-Front priority also defines a future Front+End tie; this is a proposal, not an accidental ordering.
C covers every current multi-A exception without adding special cases.

For D, eligible pool sizes are Fire **193**, Water **166**, Wood **235**, Light **38**, Dark **35**; starters:
Fire **19**, Water **14**, Wood **22**, Light **5**, Dark **1**. **These numbers must not be added:** one outfit can
appear in several eligible pools, but becomes exactly one element after the owner chooses. Similarly, B/C's basic
pool is not a prediction that three equal-sized populations will actually be selected.

**Original recommendation: C, now superseded by the owner's approved registration above.** The retained alternatives
explain the earlier count comparison; none is an additional selectable ruleset. The owner's choice keeps Front+Pace
and Late+End in Light/Dark while adding Dirt's all-five freedom. No party is required to include one of every element.

### Element effectiveness

Use the familiar relationship: **Fire beats Wood, Wood beats Water, Water beats Fire; Light and Dark beat each other**.
The official Nintendo-published PAD spin-off manual confirms that graph and the five attack colours plus Heart healing;
it is evidence for the relationship, not a claim that every current mobile formula is identical.
[Official battle manual](https://csassets.nintendo.com/noaext/image/private/t_KA_PDF/manual-3DS-puzzle-and-dragons-z-and-super-mario-bros-edition-en?_a=DATAg1AAZAA0).

**Proposal:** attacks at advantage ×2, basic-triangle disadvantage ×0.5, everything else ×1. Light/Dark have no
reciprocal resistance: both sides are dangerous to each other. Same element is neutral. Enemy attacks damage the
shared HP pool using their displayed attack value, not a hidden average of the party's colours. All five party elements
must remain viable against a boss through neutral damage, healing and routing; weakness is an efficiency advantage.

### Five elements, four material styles

Puzzle element is combat identity; CL ticket style is spending eligibility. **They cannot be treated as the same enum.**
The accepted plan ties enemy colour to a visible reward discipline as follows, independent of registration eligibility:

| Defeated enemy element | Accepted CL ticket family |
|---|---|
| Fire | FR |
| Water | EC |
| Wood | LS |
| Light | PC |
| Dark | **PC or LS**, authored explicitly on that enemy variant |

A Dark variant always advertises which of the two it grants before entry; it never randomly chooses after victory.
The Dark boss route offers **Pace** and **Late** variants with the same total payout. No fifth ticket, wildcard drop,
or implicit conversion is required. This preserves the original Pace+Late association while all four styles have a
direct boss target. A Fire Uma can earn/use a PC ticket if its source Pace aptitude is A; its chosen combat colour
does not restrict its inventory reward or material spend. The owner accepted this conversion map with the other recommendations.

### Dual elements later

Dual attributes are not just a newly invented idea: PAD's official April 2023 update already added a **third** attribute.
[Version 20.5](https://www.puzzleanddragons.us/single-post/ver-20-5-update).
For our first release, one primary element keeps registration, colour coverage and damage readable.
Reserve a future nullable secondary element in the conceptual design, **not unused save fields now**.

An eventual secondary should be a visibly unlocked option from an outfit's eligible palette, with its own reduced
attack component and matchup, not two full-strength attacks or a second EXP track. It must not retroactively change
CL ticket eligibility or which material an enemy was frozen to drop. Freeze order/multipliers and simulate two-colour
teams before approving it; do not copy PAD's third-attribute coefficient into our initial balance.

## 4. Roster, parties and Puzzle progression

### Independent outfit identity

**Proposal: Puzzle Level is global per outfit**, as Farming/RPG progression is, not per party, character or scenario.
Five saved party maps are separate; moving an outfit to another party does not reset or duplicate its level.
This interprets the brief's independent Uma leveling; an account-wide single PL would be a materially different choice.

Enroll an owned outfit through the shared Uma picker. Preview eligible elements, original grades, starting Puzzle
stats and its skill archetype; confirm the element once. No race level, constellation, parent setup or RPG class is
required. Template base stats/growths and eligibility inputs are frozen with an enrollment-rules version.

**Proposal:** before an outfit has entered any puzzle battle, allow free correction to another eligible element.
After its first battle reservation, its choice is locked. This prevents a mistaken signup from becoming permanent,
without using reloads/edits to counterpick an open encounter. A future respec system is separate scope.

### Parties

Five named presets; five distinct owned, enrolled outfit ids in a fixed order. Slot 1 is the leader. No borrowed sixth
member, helper dependency or compulsory class/colour quota. Multiple elements and one defensive utility are recommended.

**Proposal:** an outfit is assigned to one preset at a time, using an explicit Move confirmation like the current RPG.
Moving it preserves both presets' map wins. A party with an open battle cannot change members, leader or equipped
skills until that battle is finished or explicitly abandoned. An outfit's progression elsewhere never mutates frozen
battle inputs. Same-character alternate outfits may coexist initially, as separate outfits; review this if undesirable.

Each `party + scenario` retains revealed/cleared nodes, repeat counts, last viewed position and any open battle.
No chapter becomes tied to the racing scenario of the party leader. The party may replay earlier chapters or enter
a harder chapter with a level warning; no forced ten-level prerequisite or hard composition lock is proposed.

### Stats and leveling — pinned initial candidates (D269), not balance closure

Keep the useful Uma identity without copying RPG's classes. Shared HP removes individual KO bookkeeping.
Five member contributions are shown on each profile and on the party preview:

| Source | Puzzle role | Candidate formula at PL `L` |
|---|---|---|
| Speed | Elemental ATK | `round(baseSpeed + 12 × (L − 1) × (1 + speedGrowth))` |
| Stamina | HP contribution | `round(4 × baseStamina + 36 × (L − 1) × (1 + staminaGrowth))` |
| Wit | Recovery contribution (RCV) | `round(0.5 × baseWit + 4 × (L − 1) × (1 + witGrowth))` |
| Power | Physical guard contribution | `floor((basePower + 6 × (L − 1) × (1 + powerGrowth)) / 20)` |
| Guts | Resilience contribution | `floor((baseGuts + 6 × (L − 1) × (1 + gutsGrowth)) / 20)` |

Power reduces enemy flat damage, after percentage shields, with a floor of 25% of the displayed attack. The Guts
contributions reduce poison/hazard damage, also floored at 25%; they do **not** give a resurrection loop or invisible
crit chance. The HUD shows mitigated damage for the actual frozen party. Enemy scaling must account for both ATK and
HP growth; no claim is made that these coefficients are already balanced.

Party max HP and RCV are sums of its five members. Frozen growth rates are finite fractions in 0…1. The enrollment
adapter accepts fractions by default; an explicit percentage mode accepts only whole 0…100 percentages and divides
once. It never guesses units or accepts a mixture such as 20 and 0.2 in percentage mode.
No racing cards, scenario caps or lineage improvements enter these formulas. A leader's bounded passive applies
after summing; explain it in the party preview.

**Proposal: unbounded lifetime PL, no tier reset or hard level-50 cap.** Chapters use ten-level bands:
scenario tier `t` targets PL `10(t − 1) + 1 … 10t`. Today's fourteen chapters cover PL1–140; a fifteenth extends
the band. No class promotion is implied just because RPG has one. Later skills expand by published bands, not an
unbounded stack of permanent multipliers.

Initial pinned next-level EXP: `100 + 10 × (L − 1)`. Store integer EXP; cross every affordable level and carry surplus.
An ordinary win grants each of the five frozen entrants `round(0.5 × nextLevelExp(enemyLevel) × relativeFactor)`;
guardian weight 1.0, champion **1.5** (D271 supersedes D269's 2.0). Use the encounter's authored level, never the sum of enemy levels. Pinned
`relativeFactor = clamp(0.25, 2, 1 + 0.10 × (enemyLevel − memberLevel))`.

T108's accepted-win primary-route projection starts five invented PL1 entrants at 0 EXP, ends chapter1 at
**PL11 +117 EXP**, then chapter2 at **PL21 +188 EXP**. Nothing clamps to10/20; the final champion multiplier was reduced
from2 to1.5 to bring the first route near the next band. These are not real-party win-rate promises. Give all
five entrants the same base award and their own relative adjustment, regardless of how many matching colours they used.
A win earns EXP, not necessarily a whole level; the result shows progress when no level is crossed. Loss/abandon gives
no EXP or material in this proposal; repeat wins still pay.

Show every level crossed with ATK/HP/RCV/guard/resilience deltas. The bounded first-release kit uses PL1 actives/leader,
PL5 four-orb specialization and PL10 row specialization, as detailed in T107 below. Higher-band choices are an
expansion through explicitly published finite skill rows, not an automatic empty reward every ten levels or infinite
stacking bonuses. Lifetime PL/stat progression continues beyond the initial kit. Keep a compact loadout, not the RPG tree.

T106 computes carry by an exact BigInt arithmetic-series search, with safe integer inputs/outputs and explicit
overflow errors, not a capped level loop. Its receipt represents the complete crossed-level range; the presentation
can retrieve **every** level/stat delta in pages of at most 256. Ids are bounded to 120 characters, scenario registries
to 256 definitions and individual cohort/credit payloads to 4,096 units. These are transport/work limits, not a PL
or roster cap; larger account preservation needs chunked transport in T110/T115. No live save is changed by T106.

## 5. The puzzle battle

### Research takeaways

PAD's official tutorials separate orb movement, enemy attacks and recovering HP, mass attacks, attributes, and skills.
That is a useful teaching order for this mode too.
[Official tutorial overview](https://www.puzzleanddragons.us/single-post/tutorial-overview).
Its beginner training also teaches particular match shapes on fixed teams, supporting an optional isolated practice
room rather than making the player learn boss counters through material losses.
[Master Fagan's training](https://www.puzzleanddragons.us/single-post/master-fagan-s-training-novice-arrives).

Borrow the planning/drag/combo loop, shared HP, active cooldowns, one leader identity, multi-enemy targeting, route
selection and readable boss counters. Do not import gacha, fusion fodder, paid continues, helpers/friend management,
equipment inheritance, arbitrary million-fold damage inflation or the complete contemporary awakening catalogue.
The formulas below are **Uma Puzzles proposals**, not reproduced PAD data or a promise of exact PAD emulation.

### Board and input

- Retain **6 columns × 5 rows**, thirty cells, continuous held-orb swapping, orthogonal/diagonal adjacent transitions,
  revisits, deterministic interpolation of skipped pointer cells and the existing **seven-second** first-transition
  movement clock. There is no reason to rebuild the touch controller from scratch.
- Six ordinary kinds: **Fire, Water, Wood, Light, Dark, Heart**. No neutral Spark orb or strategy ring remains in combat.
- Horizontal/vertical lines of three clear. A same-kind orthogonally connected union of qualifying lines is one combo;
  a touching same-colour shape with no qualifying line does not clear. Count unique cleared cells, not overlapping lines.
- Start from a seeded match-free board with five of each kind. After a move, simultaneous clear → gravity → seeded
  refill → cascades until stable. Newly drawn orbs can contribute attacks/healing. Bound paths and cascade steps;
  an impossible cap breach is a recoverable engine error, not silent truncation or a free new board.
- Planning before the first transition is unlimited. Holding still does not consume the timer. Release without a
  transition cancels. Accepted drags, including a moved path with zero matches, advance one player turn.
- Background, orientation change, pointer cancellation or lost capture cancels an unaccepted gesture. Board and seed
  restore without a turn or reroll. One pointer owns the gesture; no React updates per pointer sample.
- Use a lock-free renderer preview during dragging; the engine/journal validates the completed action before animation.
  A failed persistence append restores authoritative state, not the visually previewed board.

### Shared HP, target and damage

**Proposal:** each map node is one battle: a regular trio, an elite group, or a boss. Starting a node fills HP and
resets battle-scoped cooldowns/statuses; no chapter-wide attrition in the first release. Heart matching remains
essential within a fight. Multi-floor endurance dungeons are a later encounter type, not hidden initial scope.

Tap an enemy to focus it; otherwise use a deterministic default: the lowest displayed countdown, then formation order.
One focus is frozen with each drag. Changing focus is free before acting. If that enemy dies, later single-target hits
retarget by the same rule. Do not randomly select a surviving foe in the renderer.

Candidate attack math, rounding each final member/match/target hit once:

```text
shape(g)  = 1 + 0.25 × (uniqueOrbs(g) − 3)
combo(C)  = 1 + 0.25 × max(0, C − 1)                 includes Heart combos
hit       = max(1, round(ATK × shape × combo × leader × pattern × buff × matchup) − enemyDEF)
healing   = round(partyRCV × sum(shape(heartGroup)) × combo × healingBuff)
```

Each Uma attacks once per group of its primary element. An unmatched member adds no attack but still contributes
HP/RCV/utility. Match a group of **five or more** attack orbs for that group's attacks to hit every living enemy;
separate three-orb groups remain focused. AoE does not split a single hit between enemies. Show a mass-attack mark
during resolution. Basic skills/Heart restoration do not create another combo. Combo count includes all cascades.

Candidate resolution order:

1. Validate and persist the action; compute all clears/falls/cascades and event steps.
2. Apply Heart healing up to max HP. Poison and its penalty are deferred, not a partially implemented launch hazard.
3. Evaluate leader/pattern bonuses; resolve attacks in Fire/Water/Wood/Light/Dark order and party-slot order.
4. Process each surviving enemy's threshold phase at most once; cancel a defeated foe's pending attack.
5. Decrement surviving enemies' countdowns; those at zero execute in formation order, with death stopping later intents.
6. Tick statuses and active-skill charge once per accepted turn; publish the next already-determined intent.
7. Test victory (no enemies), loss (HP zero), then a proposed **30-turn** battle bound. A turn-30 victory succeeds.

This replaces the old three-wave eight-turn constraint; do not accidentally retain that bound in the new adapter.
No corpse attack, healing after a terminal loss, double cooldown tick per cascade or RNG consumed by animation is allowed.

### Active skills, leader skills and optional patterns

**Proposal:** each Uma equips one active skill, selected outside an open battle from its unlocked kit. Any source A
running style can supply its archetype; this selection is **not** the permanent RPG class. Its element modifies the
chosen active's colour effect. Global PL opens choices, not multiple running-style EXP tracks.

| Archetype | Initial active concept | Candidate charge | Later choice |
|---|---|---:|---|
| Front | Change four seeded non-Heart off-colour orbs to her element | 5 turns | One-turn elemental burst instead |
| Pace | Party shield, reducing the next incoming turn by 35% | 6 turns | Heart creation instead |
| Late | Change six seeded non-Heart off-colour orbs to her element | 6 turns | Row/routing specialist instead |
| End | Delay one focused foe by one countdown step, once before it acts | 7 turns | Cleanse one board-hazard family instead |

Counts are capped by eligible cells; no forced removal of Heart. Selection order comes from an independent named RNG
stream. Active skills start at zero charge in each battle, become ready after the stated accepted turns, then reset
on use. Up to one active per member may be used between drags; it does not advance a countdown, and cannot be used
again until recharged. Conversions never resolve automatically: the next drag still matters. Boss delay immunity is
visible and disallows wasting a skill. No consumable MP, duplicated Spark Shift gauge or paid skill leveling is proposed.

Slot 1 contributes **one** leader passive, not a PAD-style friend multiplier stack. Suggested first pass: a combo
leader (×1.2 party ATK at four combos), a durable leader (×1.15 party HP), or a recovery leader (×1.2 RCV).
Choose one unlocked passive outside battle; no leader can multiply ticket rewards or EXP. A mono-colour leader can
be added after basic/rainbow compositions are measured; do not begin with a mandatory all-five-colour proc.

Match-shape specializations should be small and non-stacking initially: exactly four connected attack orbs can give
a specialist ×1.25 on that group's single-target hit; a full six-cell row can give its specialist ×1.25 on that
group's mass hit. A group gets at most one pattern bonus. Add L/cross/box conditions only with a guide and tests;
the first production chapter does not need the full PAD awakening system.

**M030's bounded delivery kit:** all source-A initial actives and the three leader choices are available at PL1;
one four-orb specialist pattern becomes selectable at PL5 and the row pattern at PL10. Equip one active, one pattern,
and the slot-1 leader passive; no stacking unlock at each later ten-level band. Later active variants/hazards and
higher-band skill rows are expansion scope rather than half-implemented rewards. T107 publishes the exact recipe table,
duration/charge semantics and tested coefficients. A shield uses the strongest percentage, not an additive stack,
covering the next damaging enemy phase; one foe cannot be delayed repeatedly before its next intent executes.

### Implemented battle v1 rules (T107, D270)

The coefficients above are now pinned **initial candidates**, not tuned production claims. Exact recipe ids:

| Unlock | Recipe | Effect |
|---|---|---|
| PL1, source Front A | `puzzle:front-convert` | Up to4 non-Heart off-colour cells → chosen element; charge5 |
| PL1, source Pace A | `puzzle:pace-shield` | 35% shield for the next damaging enemy phase; charge6 |
| PL1, source Late A | `puzzle:late-convert` | Up to6 non-Heart off-colour cells → chosen element; charge6 |
| PL1, source End A | `puzzle:end-delay` | Focused foe countdown +1 before its next intent; charge7 |
| PL1, slot1 leader | `puzzle:combo-leader` / `puzzle:durable-leader` / `puzzle:recovery-leader` | Four combos ATK×1.2 / HP×1.15 / RCV×1.2 |
| PL5 / PL10 | `puzzle:four` / `puzzle:row` | Exactly four single-target / complete six-cell row mass hit ×1.25; one equipped pattern |

Default active is the first eligible source-A style in Front/Pace/Late/End order; default pattern is none. Each
frozen input explicitly selects a leader, with only slot1 supplying that single passive. HP/RCV leader sums are
rounded once at battle creation. Every group's combo count includes all Hearts/cascades. In this finite kit the
formula's other ATK/healing buff terms are1; there is no unseen stat-growth passive or elemental resistance average.

Player damage rounds the complete member/group/target product once, subtracts DEF with minimum1, then applies the
**strongest** qualifying enemy Guard/Ward reduction and rounds once more with minimum1. Guard/Ward do not stack;
reaching each barrier's displayed combo threshold bypasses that barrier. The enemy phase applies shared flat party
guard after shield: `max(ceil(displayedDamage×0.25), round(displayedDamage×(1−shield))−partyGuard)`. Party guard and
resilience sum the five frozen outfit values; resilience has no hazard effect until hazards are authored.
Heart healing rounds once, then caps at maxHP. Shared HP starts full each battle.

After board resolution/healing, hits iterate element → slot → cascade/canonical group → formation. Default focus
and any retarget use lowest countdown, then formation index. Death cancels later intents immediately. At the end
of every accepted drag (even a zero-match or terminal drag), charge ticks once and used-between-drags flags clear;
an active/abandon never ticks turns or charge. Equal/stronger pending shield, zero eligible conversion, immune or
already-delayed foe reject without losing charge. Shield survives empty/support-only phases, covers every attack
in the next damaging phase, then expires. A foe's delay marker clears on **any** executed intent, not just attacks.

Enemy ids are `puzzle:striker`, `puzzle:ally-healer`, `puzzle:guard`, `puzzle:converter`, `puzzle:combo-ward`,
`puzzle:guardian`, `puzzle:champion`. Intent parameters are frozen explicitly, not fetched from art or a fallback
script. Healer picks lowest proportional-HP living ally (formation tie), excluding itself; no ally is a visible
no-op. Guard is50% for exactly the **following** drag; Ward has explicit reduction≤50%, threshold and1…3-drag
duration. Barriers expire at the end of their last covered drag. Converter previews distinct ordinary from/to kinds
and up to4 cells, uses its own stream and never auto-clears. Both conversion families retain canonical changed-cell
indices. A champion's single rage fires strictly **below**50%, optionally changes to its pre-authored element,
and publishes a full warned countdown before a future attack. Current tick does not shorten that warning; a pending
End delay is preserved. Rage damage rounds its explicit multiplier once before mitigation, and its countdown applies
to subsequent intents. Reward-style vector stays frozen at entry. Poison/jammer/locks/colour ward are rejected.

Transport/work bounds: five entrants,1…5 foes,1…4 cyclic intents/foe; countdown1…30, combo threshold1…30,
enemy HP/DEF/heal/base-damage≤1,000,000,000, rage multiplier>1 and≤4. Drag path2…256 adjacent cells (including
diagonal/revisits), elapsed0…7,000ms; battle30 drags; complete journal181 actions; cascades64; match-free opening
2,048 retries; uniform RNG rejection32 attempts. Work-bound or safe-arithmetic failure is a typed recoverable error,
never partial state, truncated rewards or a rerolled seed. These transport bounds are not lifetime PL caps.

Named xorshift32 streams independently seed opening, refill, player conversion and enemy conversion. Refill is
column-left-to-right, bottom-first; groups/clears sort by first cell/cell index. Presentation interpolation is integer
diagonal-first, and a no-transition release remains cancellation, not an action. Spark utilities are unchanged.
Two full synthetic journals pin every intermediate hash; one includes Hearts, focus, active conversion/shield and rage.

### Enemy behavior and counterplay

Every foe shows art, element, HP, target state, countdown, next move, and the resulting mitigated damage before a drag.
Short status chips explain duration/conditions. The preview lists a boss's phases and any immunity before entry.
Private identity/art joins a checked-in behavior recipe; **original PAD combat stats and scripts are not copied**.

| Recipe / mechanic | What the player reads | Counterplay / release stage |
|---|---|---|
| Striker | Big hit after a long countdown | Kill or shield before it acts; opening chapter |
| Healer/support | Heals one ally, not itself, on its countdown | Focus it or mass attack; opening chapter |
| Guard | One turn at 50% incoming damage | Heal/charge, or meet a shown combo condition; opening chapter |
| Converter | Changes up to four named orbs, then later attacks | Plan around the preview or keep a converter ready; opening chapter |
| Combo ward | Reduced damage below a stated combo threshold | Multiple groups/cascades, not just one large match; early boss |
| Rage phase | Below 50% HP, stronger attack after a warned countdown | Save burst/shield; no immediate lethal threshold hit; early boss |
| Orb lock | Locked orbs still move/match, but conversion cannot change them | Route normally or cleanse; later chapter |
| Jammer | Matches as a colourless non-damaging group | Clear space without hiding real colours; later chapter |
| Poison | Cleared groups cost a capped, previewed share of team HP | Heart routing/cleanse/resilience; later chapter |
| Colour ward | One named colour gets reduced damage temporarily | Other colours or wait; later chapter, never indefinite immunity |

No opening-chapter unavoidable preemptive knockout, blind timer theft, hidden damage absorb or compulsory rare outfit.
One regular has at most one special mechanic; guardians combine at most two; champions introduce a clear phase change.
Do not randomly reroll a boss's colour when its HP crosses a threshold: freeze phases at entry and preview the change.
Rewards always use its entry reward identity, not whatever colour it died in.

Mixed squads make targeting matter: eliminate support, soften three foes with mass attacks, or burst the earliest
striker. Bosses make cooldown timing, healing and combo routing matter. The target is readable planning, not another
rules glossary containing every PAD hazard.

## 6. Chapters and the farming loop

### Map shape — proposed, intentionally not an RPG clone

Reuse the current RPG's **launch pad, top-to-bottom branch map, node preview and per-party resume**, not its exact
node count, twelve-level bands, Octopath shields, carried MP or save structs. D266 changed RPG to twelve levels;
**Uma Puzzles retains the owner's ten-level target** independently.

One chapter per scenario, in registry order. Each has three sectors and five final elemental boss routes.
Proposed primary progression:

| Sector | Required regular fights on one route | Guardian | Target levels within chapter |
|---|---:|---:|---|
| Opening | 3 | 1 | 1–3 |
| Middle | 3 | 1 | 4–6 |
| Final stretch | 4 | 1 | 7–9 |
| Champion routes | 0 | one selected champion | 10 |

T108's pinned recommended levels within these sectors are regular rows **1,2,3 / 4,5,6 / 7,8,9,9**, guardians
**3,6,9**, champions **10**, offset by the chapter band. They are named/pinned alongside encounter scaling,
not inherited from RPG. Both choices at each reached row are previewable/replayable; clearing either advances.

Each regular row offers two alternative squads; choose one to progress, and reveal the other for optional replay after
that row is reached. This gives **20 regular nodes + 3 guardians + 5 champion nodes = 28 map nodes**, but the primary
route clears **10 regulars + 3 guardians + 1 champion = 14 encounters**. Dark's PC/LS variant is one champion node
with a pre-entry reward choice, not a sixth route. Require all three guardians before Finals; any champion clear marks
the chapter complete, with other routes remaining farmable. Distinguish primary completion from optional full-map clear.

Each regular trio has **exactly one Light or Dark foe and two distinct basic-element foes**, as requested.
Use all six pair/side combinations across a chapter, not just two examples; avoid making all safe paths pay the same
two styles. Basic starter chapter enemy identities can come from the requested early Monster Book families, with
their weaker variants in squads and stronger variants as guardians/champions. Exact cast/art authoring stays private.

A guardian is one mono-element boss; it is not forced to share the party's colour. The final five routes are
Fire/Water/Wood/Light/Dark champions. A node preview gives recommended PL, foe elements, intent recipes, weaknesses,
exact ticket families/quantities and the party's estimated strength. It can warn without forbidding a higher chapter.

### Implemented map and encounter coefficients (T108 / D271)

Generation is code-authored in registry order, never save-seeded. The six trios cycle in this order:
Light/Fire/Water, Dark/Fire/Wood, Light/Water/Wood, Dark/Fire/Water, Light/Fire/Wood, Dark/Water/Wood.
For ordinary row `r` (1…10), lane `b` (0/1), registry index `i`, mix index is `(r−1 +3b+i) mod6`.
Both lanes contain all six combinations. The ordinary third role cycles Striker/Healer/Guard/Converter/Ward/Striker
at `(r−1+b+i) mod6`; the first two are Strikers. Guardians use Guard/Converter/Ward by sector and element index
`(i+2×sector) mod5` in Fire/Water/Wood/Light/Dark order. Dark ordinary/guardian drops are explicitly **Late**;
only the one Dark champion node has a pre-entry Pace/Late choice. There is no hidden reward reroll.

Enemy stats use the **fixed invented reference**, not the entering party: base Speed110/Stamina170/Power90/Guts70/Wit90,
10% Speed/Stamina growth, five reference members. At authored level `L`, define
`A = round(110 +12×(L−1)×1.1)` and `H =5×round(680 +36×(L−1)×1.1)`.
Enemy HP is `round(A×kindHP×roleHP)`; displayed attack is `round(H×kindDamage×roleDamage)`;
DEF is `5 +2×(L−1)`. The engine still applies actual party shield/Guard and its incoming25% floor afterward.

| Kind | HP / A | Attack / H | Opening countdown | Attack countdown |
|---|---|---|---|---|
| Ordinary | 5.5 | 0.29 | 2 | 2 |
| Guardian | 28 | 0.58 | 1 | 2 |
| Champion | 42 | 0.54 | 2 | 2 |

| Role | HP multiplier | Attack multiplier | Support recipe |
|---|---|---|---|
| Striker | 1 | 1 | none |
| Healer | 0.8 | 0.8 | heal15% of its maxHP to lowest-ratio living other ally |
| Guard | 1.1 | 0.95 | 50% guard for next drag, bypass at3 combos |
| Converter | 0.9 | 0.9 | convert4 Fire orbs to own element (Water→Fire for Fire foes) |
| Ward | 1 | 0.9 | 50% ward for next drag, bypass at4 combos |
| Champion | 1 | 1 | same ward, plus rage strictly below50% HP: attack×1.4, countdown1 |

Support countdown is1. Ordinary special foes use support then attack; guardians/champions use attack then support,
so their early pressure is real. Every foe has an attack and no preemptive damage or delay immunity. Champion rage
is warned, preserves its element in these initial recipes, and retains the normal T107 future-countdown/delay rules.
The exact preview resolver is also the frozen-input resolver. Cast joins supply verified ids and role/element tags,
not damage stats. Missing coverage is an explicit error, never a synthetic production fallback. Engine v1 enemy-value
transport bounds still apply; overflow rejects rather than silently flattening higher-band enemies.

### Material target and repeat rewards

**Proposal: guaranteed quantity, no low-chance material drops.** Each regular foe contributes one ticket on an
encounter win. A regular trio therefore pays three; a guardian four; a champion twelve:

```text
primary route = 10 × 3 + 3 × 4 + 1 × 12 = 54 scenario tickets
optional full map = 20 × 3 + 3 × 4 + 5 × 12 = 132 scenario tickets
```

The **54** is gross output for a fresh primary route **before debt repayment or exchange**, not a global lifetime
limit, not per-member loot, and not a promise that every choice of route equips six identical-style Umas immediately.
The whole party receives one account payout, never five copies. First clears and replay wins use the same base reward;
first-clear flags reveal progress/cosmetics but do not silently add another ticket bonus.

Each ticket's scenario is the chapter being played, regardless of PL or racing scenario. A boss does not grant all
four styles at once. Pick the appropriate mono-element boss to focus a stock; Dark previews PC/LS choice before
the battle snapshot is frozen. Repeat attempts get new deterministic attempt ids/seeds only after the previous
one is terminal; reopening a live attempt never reselects enemies, variant or board.

### Making the target usable, not just a total

Style-restricted tickets can be stranded. Validate a route's reward vector against the five entrants' original A
eligibility using a small integer allocation check, and additionally test several six-outfit recipient groups.
This does not authorize a greedy allocator to choose recipients or automatically spend their inventory.

A Fire + Water + Light trio pays FR + EC + PC; a Fire + Wood + Dark(Late) trio pays FR + LS + LS. Show this vector
on the node, not just `3 tickets`. A party of five Pace-only outfits cannot consume the FR/EC/LS portion merely
because its members chose basic elements. **Fifty-four gross tickets are not fifty-four universal tickets.**

Provide three separate balance reports: (1) gross primary-route 54; (2) usable coverage for common mixed A-style
recipient groups; (3) additional boss wins required for a same-style recipient group. If the owner wants six Umas
maxed **for every** possible roster on exactly one route, this budget alone cannot guarantee it: flexible drops,
same-scenario style exchange or a larger total would be an additional design decision. The recommendation is to retain
targeted boss farming rather than add an unrequested style exchange.

### Loss, replay and longer fight types

Loss preserves the map and already-earned rewards but pays nothing for that failed encounter, even if two foes died.
Retry is free in the recommended entry model; it starts another attempt with a fresh seeded board, not a restored win.
Abandoning is a persisted terminal action; navigation alone only suspends the current battle. There are no paid continues.

After the core chapter loop works, useful extensions are: a two/three-floor endurance dungeon carrying HP/cooldowns;
a boss-rush route with several mono bosses; a no-skyfall combo trial; a fixed-team teaching challenge; and optional
shape-specific technical fights. All must preview modifiers and rewards. Do not add timer-based expiry, rotating daily
availability or timed events just to imitate a live service. The scenario farm must remain available when wanted.

## 7. The exchange shop

Same style, adjacent scenarios only, **in both directions**, using the existing scenario registry's order:

```text
1 Unity Cup FR → 2 URA Finale FR
2 URA Finale FR → 1 Unity Cup FR
```

No FR↔PC exchange, no non-adjacent shortcut, no odd half-ticket, no value loss from an integer overflow. For a batch,
show input, output, stock after, and any debt intercepted. The inverse preserves exchange value absent debt; the
operator does not mint a profit by cycling. Higher-tier replay can intentionally farm many lower-tier materials.
At fourteen scenarios, tier-14 stock is equivalent to **8,192 tier-1 tickets** after thirteen downgrades, so the economic
impact must be tested, not dismissed as a small shop convenience.

**Proposal:** a conversion edge becomes available account-wide after any saved party first clears the higher chapter's
Opening guardian. This does not require a recipient Uma's racing promotion. It stops tier-1 farming alone converting
all the way to the final tier, while preserving the requested two-way exchange once a chapter is actually reached.
If the owner wants all edges immediately available, keep that freedom and rebalance chapter incentives; do not silently
disable up-conversion because it allows stockpiling later-scenario items.

**Debt is applied to exchange output too.** Otherwise old inventory could convert into a indebted destination and
bypass repayment. Inputs consume only positive inventory, not a negative balance. If debt intercepts some/all output,
the exchange is not reversible: the confirmation must plainly say `2 earned → 2 repayment → 0 added to Items`.
Never withdraw source items until the exact repayment preview is confirmed and revalidated.

One transaction consumes input stacks, reduces matching output debt, deposits only net output, writes paired exchange
evidence and queues all changed rows. Expected revisions and operation id make double taps/retries harmless. Identical
receipts are success; a reused id with a different payload is an error. No deletion of old ledger rows is involved.

## 8. Preserving existing progress and the negative ticket bank

### One-time cohort, no new free unlocks

This is **not** a second Inspiration advance. Preserve each existing outfit's existing scenarios and exact level;
do not open new scenarios, raise low levels to CL10 or touch parent/gold/Extra stats unlocks. Freeze the authoritative
outfit/scenario cohort once at cutover, after older saves have migrated and pending old Spark results are resolved.
Newly acquired outfits/scenarios after this snapshot are outside this one-time charge.

For an old unit at TL `n`, debit **`n − 1`**, not `n`: CL1 was the free starting point. CL10 charges nine.
All four presets represent one unit and incur **one charge**, not four. Already-spent universal tickets and historical
Spark gains are included through the preserved level, not charged a second time through their history.

**Proposed debt allocation:** select exactly one originally A style for each unit: its explicitly saved preferred
style if still a source A, otherwise the stable Front/Pace/Late/End first-A order. Freeze that selection in its
receipt; future preference/lineage edits never reassign debt. Show the aggregate scenario/style breakdown before
applying the migration. Do not debit every A aptitude. An owner choosing a scenario-wide debt pool instead would
avoid style bias but change the matching-material rule; that alternative was not selected in the accepted plan.

Never debit an unparseable/unknown-source outfit by guessing. Hold the cohort in a visible resumable `preparing`
state until its source or authoritative row can be resolved. No new Puzzle reward or exchange is collectible against
an incomplete bank; unrelated racing, Farm and RPG can still operate. Existing positive inventory is retained.

### Bank and ledger semantics

Keep a distinct Constellation bank; never reuse `inspirationBank` or negative `items.quantity`. Proposed balances are
signed nonpositive integers keyed by scenario/style, with a frozen cohort and a one-time completion stamp.

For gross acquisition `g` and matching balance `b ≤ 0`:

```text
repayment = min(g, −b)
newBank   = b + repayment
netItems  = g − repayment
gross     = repayment + netItems
```

Example: URA FR bank −7, a FR boss pays12 → bank0, **7 repaid, 5 deposited**. URA PC debt does not intercept URA FR,
and Unity FR does not intercept URA FR. Zero-debt rows retain the migration receipt, so a reinstall cannot charge again.

Every future CL acquisition uses this projection: fight reward, exchange output, any later administrative grant.
Gross evidence records withheld repayment and net value; item reconstruction subtracts repayment just as Inspiration
evidence does. Retrying a result, syncing, reloading or re-adopting a bank never repeats the debit or reward. Debt
can only move toward zero after activation. Temporary bank creation/debits need a protected, bounded one-time operation;
copy the **resumable cohort** safety of D256, not its unlock counts or a mandatory online step for every battle.

Result screens always show gross, repaid and deposited by real item name. `12 tickets earned` without `12 repaid`
would hide why inventory stayed unchanged. The Hub/Items expose remaining debt and explicitly explain that legacy
CL is already usable, even while rewards repay its advance.

### Existing universal tickets and partial Training EXP — recommended preservation

Current accounts can have `training:level-up-ticket`, partial EXP on several scenario units and the account EXP bank.
Removing those without compensation is unacceptable. The detailed schema migration is a future task; proposal:

1. Resolve old schema migrations once; preserve CL, assignments, card sets, loadouts, Extra stats, Inspiration,
   racing history, badges, outfit ownership and global card stars verbatim.
2. Keep existing generic Level-Up Tickets as **Legacy Universal CL Tickets**. They remain worth one increase in any
   unlocked scenario on an outfit with a qualifying style. No new puzzle battle produces them. Do not consume them
   to clear debt automatically, and do not assign them a random scenario/style at conversion.
3. Transfer all remaining **unapplied** scenario Training EXP plus the account bank to a one-time legacy credit pool.
   Each full old 1,250 becomes one preserved universal ticket; retain the final fractional remainder visibly. Clear
   transferred unit EXP only in the same migration transaction, with a receipt of the exact totals. Applied levels
   are never included in this pool; older overflow already settled to tickets is not counted twice.
4. The owner accepted the recommended **one-time round-up** of the final account fraction to one legacy ticket,
   explicitly recorded as migration compensation, at most one per account. Do not pretend it is value-neutral or round
   each unit separately. The earlier fractional top-up alternative is not part of this plan.
5. Conversion/round-up preserves value already owned, so it does **not** count as a new reward that repays the bank.
   Spending a preserved ticket still changes CL normally; it must not re-debit the frozen migration cohort.

The accepted selection is **preserve generic stock + pool remainders + at most one account round-up**.
Tests must pin this choice before any live migration. A preview shows preserved levels, ticket stock, converted EXP,
round-up and new debt separately; capture a recoverable pre-cutover snapshot through existing save tooling.

### Retiring Spark safely

Reuse the established retirement rule (D177): an **unfinished paid Spark run** closes with its original daily Training
Ticket refunded exactly once under retirement evidence. Completed runs remain historical and never pay/refund twice.
Resolve a pending committed result before freezing legacy levels; never both refund a run and apply its uncommitted EXP.
Keep versioned parsing for old rows long enough to distinguish these states; malformed history is a visible recovery
case, not something to erase. Old Spark links redirect to the global Puzzle Hub with an explanation, not to a battle
silently enrolled for that Uma. Updated clients refuse old Spark reservations/commits after cutover, and API schema
guards reject old-app writes over the migrated account. An old cached client can still simulate locally while offline;
it must receive an explicit update/recovery message when reconnecting, never overwrite newer rows or re-bank old EXP.

## 9. Screens, guides and visual identity

### Own navigation, familiar components

**T112–T113 implemented (D275–D276), release still disabled:** lazy `/puzzles` setup and battle routes use the real host,
not a production double. The gate runs before host/account/content I/O; deep links cannot enable the capability.
There is no Home card or account cutover yet. `/puzzles/content` remains a separate read-only preflight. The DEV phone
proof runs only an isolated invented account; [setup](../research/puzzle-navigation-phone-proof.md) and
[battle screenshots](../research/puzzle-battle-phone-proof.md) are separate from device acceptance.

Home card shows **Uma Puzzles**, last party/chapter and saved battle/resume state. Open the saved Hub, not an Uma
picker. Internal destinations: **Parties · Roster · Chapters · Exchange · Items**, with a shared header/back/guide;
do not add five global bottom tabs. Reuse the RPG's compact five-across Uma icon treatment and shared picker, but
separate its state and labels.

- **Roster:** enrolled before unenrolled, source filter/element filter, PL and element overlay on each portrait.
  Detail shows stats, next-level deltas, eligible/frozen identity, active kit and leader skill.
- **Parties:** five cards, five member icons each, leader mark, colour coverage, average/range PL and per-chapter resume.
  The picker excludes other draft slots, explains an explicit transfer and never edits an open battle's party.
- **Chapter launch pad:** scenario crests, target PL band, selected party, clear/resume badges and material preview.
- **Map:** branches, readable node levels, enemy element triplets, boss-route colour plus reward-style glyph. The
  preview shows combat modifiers, exact stock/debt effects and Begin/Resume. No gameplay-blocking Sync button.
- **Battle:** monsters and intents above, team HP/status, five Uma portraits with active-charge rings, then the 6×5
  board and thumb-zone actions. Portrait taps open/activate a ready skill with a clear preview, not an accidental use.
- **Result:** clear/loss first, combo/damage summary, each entrant's PL/EXP/stat changes, newly unlocked skill choices,
  and the **gross → repaid → inventory** material table. Continue map, Replay and Items; never auto-spend CL tickets.
- **CL spend result:** separate from battle results. Names actual opened card nodes and stat/SP increases and links
  back to that unit's Constellation. Inspiration/Extra stats display no false new unlock animation.

Implemented setup details: the owned roster has five compact icons per row, enrolled-first name/id ordering,
original-A/element filters and visible unavailable no-A entries. Registration shows frozen original grades/version,
PL1 contributions and eligible actives; colour-count advice never selects a colour, even for fixed Light/Dark.
Confirm enrollment/correction explicitly; first entry permanently locks colour after loss/abandon too. Profiles
show remaining EXP, next-level five-stat deltas and finite unlocked kits. Roster defaults affect future assignments,
not existing party-slot kits. Names, slot edits/order/leader and unlocked kit edits save through revision-checked host
operations. The unassigned-only picker has a deliberate named transfer confirmation retaining both party revisions;
an open battle on either side blocks it and checkpoints survive. Slot1 is the leader; no required rainbow/style quota.

The launch pad includes all fourteen registered crests/ten-level bands, without racing-scenario ownership gates.
Five filled slots are required to launch; average/range PL warnings do not gate adventurous parties. Each map is a
DOM-labelled 28-node branched path: exact enemy colours and ticket quantities, locked/reached/won/replay states,
three Guardians and five final colour routes. Any Champion completes a chapter; all 28 wins clear its full map.
Preview uses the engine's actual recipe plus held verified enemy names/art, not invented production rows; it shows
intents, phases, delay immunity, element legend, low-level warning and gross/repayment/net. Dark Champion requires
an explicit Pace/Late choice; an open fight displays its frozen choice and entrants. True Resume names the node,
loads its real journal or read-only recovery, and offers explicit online same-seed takeover without reserving again.
Exchange/Items honestly explain their forthcoming T114 implementation. Begin now reserves the complete frozen fight
through the real host, then opens its accepted journal; production routes remain gated. Resume never calls Begin.
Saved terminal receipts survive refresh, and Replay reserves a new attempt only after the previous receipt exists.

Selected party/chapter and per-party/per-scenario last viewed node are resilient device-only navigation memory,
not progress or a release switch. Roster/map/editor scroll inside the shared dark safe-area shell; actions are at
least 44 pt at 390×844 and 375×667. Every element has its own original glyph and name as well as its colour. No private
content, owner save, engine numbers/hashes, other modes or current Spark launch changed in these UI tasks.

Implemented battle: Pixi owns one captured pointer, lifted orb, displaced neighbours and pooled engine-event effects;
DOM owns HP, three enemy intent summaries/sheets, five active previews/confirmation, Matchups and one announcement
per resolved turn. First valid cell transition starts the monotonic clock. Append succeeds before animation and input
stays locked through save/resolve/commit. Background/resize/rotation/capture loss/guide/navigation cancels unaccepted
input; resume replays the journal before unlocking. Landscape prompts for portrait without advancing a turn.
Plain/chibi display preference and reduced motion do not enter the action or engine streams.

Results show all five exact EXP/before-after PL/stat deltas and newly unlocked authored choices; materials show each
scenario/style's gross, repayment and net Items. Pending receipts explain canonical correction. Optional combo/damage
detail is replayed from retained device journals, not saved as new schema fields; another device without that journal
honestly shows detail unavailable while retaining exact reward receipts. Loss/abandon is zero reward, not lost history.

### Art and colour

Keep Uma portraits/chibis for the party and active-skill celebration. Preserve the existing chibi-board character
identity where it remains readable: an element ring and prominent element glyph replace strategy letters, with the
cast frozen as a **display-only** deterministic join. Heart uses a clearly different pink heart treatment. Also provide
a plain element-orb presentation for visual comparison/reduced clutter; choosing it cannot change rules or seed.
Actual PAD monster art fills the enemy stage. Never depict an Uma as the new monster opponent by silently reusing rivals.

Proposal palette: Fire red-orange/flame, Water blue/droplet, Wood green/leaf, Light pale ivory-gold/star, Dark violet/moon,
Heart pink/heart. In particular, **there is only one green combat colour**. Glyph, accessible name and legend accompany
colour everywhere. Existing strategy colours remain on **ticket icons**, not as a contradictory combat-advantage legend.

### CL ticket icon brief — future original SVG work

Extend the established SVG item/icon system; no new bitmap dependency or extracted PAD icon is needed. Four ticket
silhouettes with a constellation-star punch, a large original FR/PC/LS/EC strategy glyph, existing strategy colour,
and a scenario crest inset. At small size the scenario label/accessible name carries the tier; do not cram tiny text
onto the image. Test both 24/32 px inventory marks and 48/64 px rewards. Style must remain legible on dark/light
surfaces and in grayscale. A distinct silhouette separates it from daily Training Tickets and Inspiration tokens.
In the implementation PR, author the four reusable base SVGs plus composited scenario variants; this draft does not
ship placeholder art or claim the icons have already been drawn.

### Tutorial and practice

The implemented illustrated eight-page guide reuses `PagedGuide`, `createGuideMemory`, contextual first page, shared
shells and reduced-motion handling:

1. Global loop: earn now, consume later; Puzzle/Uma/CL levels are different.
2. Continuous drag and seven-second clock, with an isolated interactive board.
3. Groups, cascades, combo multiplier and five-orb mass attacks.
4. Basic triangle and mutual Light/Dark advantage; permanent Matchups shortcut.
5. Team HP, Hearts, targeting, countdowns and enemy intent.
6. Ready active skills, one leader, visible boss counters.
7. Party chapters, colour routes, EXP and repeated farming.
8. Ticket styles versus elements, eligible CL spending, exchange and negative-bank repayment.

Open once before first registration/battle entry, always reachable from Hub and battle at the relevant page. Practice
is device-local synthetic state, not an account enrollment or rewarded run. Examples read constants from the engine;
no copy-only timing/multiplier. Opening a guide pauses unaccepted input, never advances a countdown or expires a turn.
Guide memory is resilient per-device v2; battle opens directly to drag controls. `/puzzles/practice` bypasses account,
auth/content and service-worker boot, checks the same off release capability, and uses standalone invented input plus
the real stage/engine when released. DEV practice is explicitly labelled. It grants no EXP/Items and writes no Dexie
account rows; it is not a non-drag accessibility assist.

### Mobile interaction and performance

Build hybrid TypeScript: pure reducer in domain, PixiJS 8 for the board/enemy reactions, React DOM for HUD/text/forms.
This is the same boundary that already supports the shipped drag game, not a DOM-per-cell redraw at every pointer move.
Reuse and profile the existing grid traversal, pointer capture, pooled sprites, held orb lifted above the finger,
resolution-event playback and hidden-tab cancellation.

At **390×844** the whole battle fits without page scroll; 6 columns inside a roughly 358 pt stage give almost
60 pt cells. Verify **375×667** too, reducing decorative enemy height before shrinking cells below useful touch size.
All controls ≥44 pt, safe padding once through `MinigameShell`, `m.*` under `LazyMotion strict`, transform/opacity only,
elapsed-time effects, no hidden ticking on background. Keep enough enemy detail for a three-foe squad without a
four-line HUD on each portrait; expanded intent sheets must not require a scroll during a drag.

Main startup ≤**180 KB gzip**; separate Puzzle Hub/map/battle chunks and lazy Pixi. Report measured startup, Puzzle and
Pixi chunk sizes in each UI PR. Physical iPhone checks cover long/fast/edge drags, finger occlusion, lost capture,
home/lock interruption, low-power mode, sustained frame pacing, offline resume and 60/120 Hz equivalence. Browser
screenshots prove layout, **not** a real device's latency. Announce one resolved turn via a DOM live region; no narration
per cell/frame. An alternate non-drag assist mode is later scope and must not be falsely claimed as present accessibility.

## 10. Implementation boundaries

### Engine and host

Follow the [Minigame kit](minigame-kit.md)'s pure rules, determinism, visual and tutorial standards, but place this global
campaign **outside its target-bound ticketed `MinigameHost`**, like Farm/RPG. A host that must name one scenario Uma and
pay Training EXP is the wrong port. Do not bend it by submitting invented trainee ids or direct screen save writes.

Proposed engine home: `packages/domain/src/minigames/uma-puzzles/`, with versioned types/parsers, rules, reducer,
canonical state hash, replay, deterministic bot and co-located synthetic tests. Share genuinely generic board/path
utilities with Spark through an explicit module; do not import a live old reward engine or copy files indefinitely.
The old engine stays callable for historical validation/retirement until safely removed.

These domain concepts now have [implemented additive schema-1 records and protocol](../technical/uma-puzzles-implementation.md#t110-implemented-persistenceprotocol-v1-d273)
(T110/D273), still behind an off capability; journal/host gameplay and account cutover are not installed:

| Concept | Ownership and frozen inputs |
|---|---|
| Puzzle outfit | Outfit id, source eligibility/base/growth snapshot, chosen element, PL/EXP, skill choices, revision |
| Puzzle preset | Five ordered slots, leader/loadout choices, last viewed chapter, revision |
| Chapter run | Party+scenario key, reached/won nodes, attempt counters, open frozen encounter, revision |
| Battle journal | Device-local engine version, input snapshot, seed, actions, expected action count, replay hash |
| Battle result | Append-only battle id, five EXP awards, gross item vector, withheld debt, outcome and state hash |
| Constellation bank | Account-only frozen cohort, nonpositive scenario/style balances, migration receipts |
| CL/exchange evidence | Append-only operation id, exact inputs, outputs, repayment and affected revisions |

Battle entry atomically freezes all five entrants, loadouts, leader, content identity, enemies, recipe versions, reward
vector, attempt index and seed. Seed derives from stable account identity + preset + chapter/node + persisted attempt,
with named independent streams for opening board, skyfalls and conversions. **No `Math.random`, wall clock, DOM or
network inside rules.** Monotonic elapsed gesture duration belongs in the bounded action; it is not a server timestamp.

Append only validated actions under expected count. A terminal commit replays the stored journal; the screen cannot
submit its own EXP, damage, tickets or debt numbers. In one transaction settle party progress, five outfit EXP,
result/evidence, bank, inventory and outbox. Only publish Zustand state after persistence succeeds. The ordinary
local-first `/api/sync` carries bounded **atomic Puzzle operation groups** and canonical receipts as specified in the
[implementation contract](../technical/uma-puzzles-implementation.md#6-local-first-sync-without-economic-last-write-wins).
Per-row entity conflict handling alone cannot protect combined EXP, stock, debt and CL changes. Pending operations
rebase together from canonical evidence; do not resurrect the RPG's retired Sync/Submit UI or call the API per drag.
T110 pins transport protections, not gameplay caps:16 groups,256KiB encoded operation array,200 total distinct
referenced records (including mixed ordinary writes),900KiB per receipt, within the existing400-operation/5MiB HTTP
bounds. Canonical receipts own material/CL changes; Farm/ordinary Racing reconciliation preserves pending predictions
and unrelated racing/build edits. A save-derived immutable cutover id supplies the stable account seed component.

### Resume, conflicts and recovery

Reload on the same device must restore the **exact board, HP, foes, cooldowns, turn and seed**. Content publication or
party edits elsewhere cannot reroll it. Retain engine version dispatch; an unsupported old journal is a visible restore
case, not permission to discard it and give a favourable board.

Device journals do not silently sync. The specified second-device policy shows the persisted open encounter and its
origin, allows viewing other parties, and requires explicit **online acknowledged takeover** to restart the **same
frozen input/seed from turn zero** if its journal is unavailable. Increment owner epoch without changing battle/reward
identity; two terminal claims cannot both pay and the prior epoch cannot settle after takeover. This narrow recovery
boundary may wait online, not normal single-device play or every reward. On reconnect a displaced device shows recovery
and retains its archived journal. Same-device corrupt/unsupported journals never silently restart. This is an
implementation obligation, not something ordinary last-write-wins outfit rows magically solve; block recovery rather
than duplicate progress if safe takeover cannot be acknowledged.

Bank creation is authoritative and one-time; subsequent repayment must retain immutable cohort and prove the movement
toward zero. Do not copy a `max(level)` entity merge for combined ticket spends: it can keep the level while losing the
spend. Result/spend/exchange evidence must reconstruct inventory and reconcile checkpoint/outfit deltas without double
application. Add API shape validators and explicit older-schema refusal; no cloud credentials or infrastructure edits
are part of ordinary engine/UI tasks.

### Private PAD content

**T109 code status (D272):** [The private content contract](../technical/puzzle-content.md) now implements source/evidence
validation, immutable packs/catalogs, transparent atlases and exact-hash authenticated leases. Pipeline limits are pinned
in `domain.test.ts`:512 members,64 retained packs,32 pages,256 px frames/2 px gutters,2048 px pages,2 MiB JSON/8 MiB images,
16,777,216 input pixels,10-second timeout/two bounded attempts, four cached pack lookups/eight idle pages. These are work/
presentation bounds, not combat or progression changes. The owner asked to pin real permitted-source collection and use
temporary original SVG placeholders while other tasks proceed. Placeholders are labelled and DEV-only; they do not prove
real PAD provenance or satisfy the production gate. T109 stays open for the final real input/art/validation pass before T116.

The requested [Monster Book 001–020](https://pad.fandom.com/wiki/Monster_Book001-020) is the initial research index.
Direct access was **blocked by robots.txt in this environment**; search indexing alone is not verified image provenance.
No working art URL, complete monster import or production cast is claimed in this draft. Do not bypass the restriction;
use owner-supplied/exported permitted source material or another verifiable source before building the private pack.

Plan five elemental starter/evolution families for the opening chapter, then a wider cast with distinct silhouettes for
later chapters. Author enemy role/level/behavior/phase/reward variants in checked-in **semantic recipes**, joining cast
ids only in ignored private inputs. Book entries, source stats/skill text, original names/art rows, downloaded images,
generated atlases and cached source pages remain under ignored `content/` or importer caches. Tests invent tiny monsters.
No bulk original-game enemy list is part of this document.

Reuse the private pipeline boundaries proven by RPG: validated source provenance/variant, local fetch/cache, alpha-safe
WebP, separately hashed monster atlas, immutable cast pack, authenticated runtime verification and retained versions
for open battles. No browser hotlink or request to Fandom during gameplay. The pure engine never depends on portrait
dimensions or remote names. Keep Uma/PriConne/PAD art families independent when importing or publishing.

A missing/unverified pack shows **Uma Puzzles content unavailable** with a retry/diagnostic; no fake monsters or silently
reused Uma rivals in production. A synthetic DEV proof is useful but cannot satisfy the private-content launch gate.
Prepare the complete real opening chapter/cast and all required atlas objects before advertising playable Home entry.
Publication and deployment must be verified independently; a green app build alone is not a playable release.

## 11. Balance, delivery and documentation work

### Small, focused validation before pinning

Start with a modest fixed-seed sample across basic-balanced, mixed Light/Dark, mono-colour and starter-only parties;
vary low/on/high PL and novice/competent routing bots. Bots use the public reducer, not damage shortcuts. This is a
testable design pass, not weeks of exhaustive optimization before the owner can play.

Candidate acceptance bands: competent on-level ordinary clear **85–95%**, guardian **70–90%**, champion **60–85%**;
median **3–6** ordinary drags and **6–12** champion drags; matched-party remaining HP usually **20–70%**, not always
full; no essential colour/recipe systematically outside its intended difficulty band. Check neutral teams as well as
counter-colour teams, and make Hearts/shields matter without creating indefinite stall farming.

**T107 engine-only baseline (D270):** `pnpm sim:puzzles` runs288 battles: four fixed seeds, four invented party
shapes (basic, Light/Dark, mono, starter-shaped), low/on/high PL2/5/8 against encounter PL5, three encounter kinds
and two public-action bots. Novice tries one adjacent swap and no actives; competent uses a six-cell, width-eight
board-only beam and ready meaningful actives, without peeking at refill RNG. Every intermediate replay hash survives
JSON transport. Exact clears/median drags/median endHP/Heart groups/active counts are regression-pinned in the script.

On-level pooled sample (16 battles per row):

| Bot / encounter | Clears | Median drags | Median ending HP | Heart groups / battle | Actives / battle |
|---|---|---|---|---|---|
| Novice ordinary | 12.5% | 6.5 | 0% | 2.00 | 0 |
| Novice guardian | 37.5% | 12 | 0% | 2.75 | 0 |
| Novice champion | 0% | 16.5 | 0% | 3.44 | 0 |
| Competent ordinary | 100% | 4 | 100% | 2.13 | 0.19 |
| Competent guardian | 100% | 5 | 97% | 2.25 | 0.44 |
| Competent champion | 100% | 6.5 | 86.2% | 2.81 | 2.06 |

All competent rows clear100%; novice low/on/high clear ranges are ordinary6.3–50%, guardian0–75%, champion0–12.5%.
Losses in this sample are HP-zero, not abandon/turn-limit. Ending HP above includes losses; these are invented
fixtures, **not** actual starters, fourteen authored chapters or production skill distributions. Competent clears/HP
are above the intended bands; novices are often too fragile. This remains an explicit T108/T116 scaling/tuning gap,
not evidence that pressure/healing is balanced. No approved coefficient was changed to fit this small sample.

Separately project a primary route through at least two ten-level chapters, fifty-four gross tickets, recipient-style
coverage, debt-first earnings and exchanges. Check start/end PL, rewards per minute, same-style boss farming and the
13-edge exchange effect. A result that only gets the total 54 right but cannot practically train the roster is not
closed balance. Pin approved constants in the design, domain pinning test, sim envelope and a **new** decision.

### T108 campaign and economy evidence (D271)

`pnpm sim:puzzles` preserves T107's288 engine-fixture battles and adds **600** campaign battles plus exact economy
projections. Use `--combat` / `--economy` to run only that part. Campaign seeds are `campaign-1`…`campaign-8`;
eight per on-level mixed/strict-neutral/counter row, first four per low/high/novice and later-band probe.
Competent/novice bot algorithms are unchanged. The five-colour mixed party includes advantages; **strict-neutral**
uses only neutral matchups (rare same-colour against ordinary trios; same basic against basic bosses; Fire against
rare bosses). Counter ordinary parties cover each foe's weakness; mono counter bosses use their weakness colour.
All parties are small invented Dirt-A sources, not imported outfits or promised starter ownership.

Measured on-level mixed party, eight battles per row (ending HP includes losses):

| Kind / foe colours | Encounter/member PL | Clears | Median drags | Median ending HP |
|---|---|---|---|---|
| ordinary · light/fire/water | 1 | 87.5% | 4.5 | 23.1% |
| ordinary · dark/fire/wood | 2 | 100% | 5 | 74.1% |
| ordinary · light/water/wood | 3 | 100% | 5 | 64.4% |
| ordinary · dark/fire/water | 1 | 100% | 4.5 | 79.7% |
| ordinary · light/fire/wood | 2 | 100% | 5 | 64.8% |
| ordinary · dark/water/wood | 3 | 100% | 4 | 86.8% |
| guardian · fire | 3 | 75% | 6 | 26.9% |
| guardian · water | 13 | 100% | 5.5 | 35.7% |
| guardian · wood | 6 | 100% | 4.5 | 61.8% |
| guardian · light | 16 | 100% | 4 | 76.8% |
| guardian · dark | 9 | 100% | 4.5 | 57.7% |
| champion · fire | 10 | 75% | 7 | 27.5% |
| champion · water | 10 | 75% | 8 | 61.6% |
| champion · wood | 10 | 62.5% | 7.5 | 35.3% |
| champion · light | 10 | 75% | 7 | 45.1% |
| champion · dark | 10 | 75% | 7.5 | 35.3% |

This is **not balance closure**. Strict-neutral ordinary clears87.5% with median4 drags, but HP48.1–92.7%; neutral
guardians still clear100% with24.5–56.4% HP; neutral champions clear62.5–75% with6.4–18.2% HP. Counter ordinary
clears87.5–100%, guardian100%, champion50–87.5%; mono counter Wood's50% clear and Dark's14.4% HP are visible outliers,
not evidence that advantage always makes the current bot optimal. Mixed novices clear0% ordinary/champion and0–50%
guardian; PL−3 champion probes clear25–50%, PL+3 clear75–100%. Four-seed mixed Fire-champion probes atPL50 and140
clear100%: median9.5 drags,72.4/75.9% HP on-level. Higher-band finite-kit scaling remains a T116 gap.
The sample records Heart matches, active uses and exact per-kind/colour/PL rows in
`scripts/sim/puzzles-campaign-envelope.ts`; every intermediate hash in all 600 battles replays identically. A small pressure pass
settled the above coefficients; no T107 engine formula, bot search or historical hash pin was bent to hit a target.

Economy enumerates **1,024 branch masks ×6 champion reward choices ×14 chapters =86,016** primary routes:
each54 gross; all full maps132. Each chapter has44 distinct style vectors, SHA-pinned along with full-map vectors.
The opening route's left branches plus Fire champion yield FR/PC/LS/EC **23/5/19/7**, not54 universals:

| CL1→10 recipients | Immediately usable | Stranded | Extra targeted champion wins |
|---|---|---|---|
| Five: FR, PC, LS, EC, PC+LS | 39 | 15 | 2: one Pace and one End |
| Six: FR, FR, PC, LS, EC, PC+LS | 48 | 6 | 2: one Pace and one End |
| Six FR-only | 23 | 31 | 3 Fire |
| Six PC-only | 5 | 49 | 5 Light or Dark(Pace) |
| Six LS-only | 19 | 35 | 3 Wood or Dark(Late) |
| Six EC-only | 7 | 47 | 4 Water |

An integral max-flow report respects original-A eligibility, and a bounded four-family search finds minimum extra
boss wins without cross-style conversion or automatic spending. The report accepts1–6 recipients needing0–9 tickets
apiece as a work bound, not an account or roster cap. Debt, real losses and live play time are outside these
accepted-win allocation projections.

Five fresh entrants project PL1→11(+117 EXP)→21(+188 EXP). A separate mixed-level cohort7/10/13/17/22 traversing
chapters2/3 ends31/31/31/32/32, carrying219/235/297/86/304 EXP: lower entrants catch up, higher entrants gain less,
none lose progress. A champion10 pays371/285/200 EXP to entrantsPL7/10/13; repeat wins still pay12 materials once.
Matching debt−7 with gross6/7/12 repays6/7/7, deposits0/0/5 and retains the zero receipt. Preserved universals and
one-time legacy EXP credit bypass this debt. All13 adjacent same-style edges are checked in both directions;
missing higher Opening clear rejects each edge. One tier14 ticket still projects8,192 tier1-equivalent tickets,
so the exchange-gate/debt economy and actual time-to-CL need real release validation, not an assertion of closure.
No headless row is described as phone rewards/minute. Skill catalogue remains the finite PL1/5/10 T107 kit.

### Specified delivery sequence — M030 / T106–T116

The owner's gameplay choices are resolved. [M030](../tasks/M030-uma-puzzles.md) now contains eleven detailed individual
task specs with dependencies, contracts, synthetic tests, acceptance and safe landing boundaries. The original six
delivery units map to the numbered sequence below; no task or milestone number is reused.

| Unit | Deliverable and completion boundary |
|---|---|
| **A. Progression/material contract — T106** | Pure registration/PL/CL/spend/exchange/debt/legacy rules and parsers |
| **B. Party puzzle engine — T107** | Board/combat/finite skill kit, replay/hash, bot and combat sim |
| **C. Campaign and private cast — T108–T109** | Generated maps/scaling/reward allocation, private PAD import/atlas/runtime and real-content gate |
| **D. Local-first runtime — T110–T111** | Additive records/API atomic operations, real host/journal, reconciliation and explicit takeover |
| **E. Mobile playable loop — T112–T114** | Hub/roster/parties/maps, touch battle/result/guide, Items/icons/debt/exchange/CL spend |
| **F. Cutover and closure — T115–T116** | Dormant preservation/retirement, then authorized content/application release and standing owner acceptance |

Implement one task to completion/PR/merge before the next, each from latest main. Code can land behind an initially
off checked-in capability (not an env edit). **Do not remove the only working training
entry or migrate the real account halfway through.** The full replacement must be playable with published content and
an accessible spend flow before the cutover becomes active. Each completed task deletes its spec in its merge PR
(D104), and never pushes directly to main.

### Required tests and release evidence

- Every element pairing, zero-match move, disjoint/overlapping groups, cascades, mass targeting, Heart cap, cooldown,
  shield/guard/phase/death order and turn cap; no animation-dependent result.
- Fixed seed + journal replay after JSON round-trip, skipped pointer cells, version dispatch, rejected malformed arrays,
  named-stream stability and no forbidden imports/random calls in the pure engine.
- Atomic reward/spend/exchange rollback, same-id retry, stale screens, reload mid-board, no repeated debt debit, debt
  crossing zero, reconciliation after interrupted sync and conflicting-device claims.
- CL shared across four presets; every preserved configuration/badge/card star unchanged; future outfits excluded from
  the cohort; partial EXP/universal inventory compensated once; unfinished/completed old runs handled distinctly.
- Private cast schema/integrity/art variant checks with **synthetic** fixtures; visible missing pack; real publication
  retains every other content family. Never test against or log private Spark rival rows.
- `pnpm lint`, `pnpm test`, `pnpm build`, relevant existing sims and a new Puzzle sim; recorded chunk sizes; screenshots
  at 390×844 and 375×667; physical iPhone evidence clearly separated from browser proofs.
- Production path: Home → enrolled full party → battle → visible EXP/material/debt → Items → eligible Uma/scenario
  CL spend → real named nodes/stat/SP delta → reload/offline/reconnect. Also test loss, boss replay and exchange.

### Documentation sweep at implementation, not premature rule replacement

Update Overview, Uma progression, Training, Constellations, Minigames, kit, Economy, global Items, Scenarios where TL
appears, badges, architecture/save contracts, README and in-app guide text together. Preserve historical decisions and
ledger names through adapters; do not rewrite old rows as if Spark had always been this game.

T106 corrected Constellations' former `max(baseStat, 50 × TL)` prose to the shipped fixed template base (D152/D269),
without changing the engine. Preserve that projection and SP progression; do not accidentally reintroduce a stat
buff through the rename. Some
training/card prose still says stars are scenario-local, and README/RPG implementation text still references
Persona/engine v2 despite D265's engine v3. Use D255 for global stars and RPG + D265/D266 for current combat/map
facts. Record targeted cleanup in the relevant implementation unit; do not overwrite Claude's current RPG changes
under the guise of the Puzzle draft.

## 12. Owner review

**Owner response, 2026-10-07:** all first-draft suggestions accepted except registration, replaced by the exact rules
in section 3, then confirmed basic-element choice for the five uncommon non-Dirt-A combinations. Record this as the
planning baseline (D267), not a claim of implementation or closed balance. **No registration or other first-draft owner
choice remains open.** PAD asset verification, simulations, save-safety tests and the phone pass are implementation
checks, not requests to approve the whole plan again.

| Choice | Accepted plan | Why it matters |
|---|---|---|
| Element registration | **Front-only/Front+Pace→Light; End-only/Late+End→Dark; other A-style sets choose basics; Dirt A chooses all five** | Matches the owner revision and explicit multi-style fallback; all 268 outfits covered |
| Five elements → four ticket styles | Fire→FR, Water→EC, Wood→LS, Light→PC, explicit Dark PC/LS variants | Connects enemy drops to all four consumable families without inventing a fifth item |
| Progression ownership and entry | Global **PL per outfit**, five filled slots, free entry/retry; ten-level chapters | Keeps this independent global loop usable without a new daily gate; no RPG class/tier reset |
| Chapter/reward budget | **14 primary-route encounters / 54 gross tickets**, optional branches and repeatable targeted bosses | Six fresh units' worth by total; no false guarantee for every restricted recipient roster |
| Exchange access | Two-way 2:1, same style, adjacent only; open an edge after higher Opening guardian | Preserves the requested exchange while preventing immediate tier-1→tier-14 conversion |
| Existing-level debt | `CL − 1`, one frozen A style per existing scenario unit; matching acquisition repayment | No baseline/preset overcharge; mutable race preferences cannot move old debt |
| Old EXP/tickets | Preserve universals; pool all remaining EXP; one final account round-up at most | Preserves existing effort with a small explicit compensation rather than deleting fractional value |
| First-release battle kit | Shared HP/Heart, one active per Uma, one leader, targeting, simple visible boss counters | Enough PAD depth to feel like a new party game without importing its whole modern complexity |

T106–T113 foundations/content code/save/sync/real replay host/mobile screens are complete (D269–D276), capability-off.
[The implemented host](../technical/uma-puzzles-implementation.md#t111-implemented-real-hostjournal-d274) owns deterministic
device journals, atomic reservation/settlement/materials and explicit online recovery. Completion flair follows accepted
CL rather than a rejectable offline prediction. [Saved setup navigation](../technical/uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275)
uses that port; [mobile battle/results](../technical/uma-puzzles-implementation.md#t113-implemented-mobile-battle-d276)
extend it without save or combat changes. [T114 material surfaces](../tasks/T114-puzzle-material-surfaces.md) is next;
[T109 real private content](../tasks/T109-puzzle-private-content.md) remains pinned. Implement one task to
completion at a time. **This document does not change the deployed app, grant/debit the account, retire Spark, publish
PAD content or claim a phone test has passed.**
