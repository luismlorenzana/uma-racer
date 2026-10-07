# Uma Puzzles — global campaign and Constellation progression

**Status: first draft for owner review, 2026-10-07. Not implemented or an approved replacement for current rules.**
Prepared against `main` at `892fd37` (D266). The owner's attached requirements are the fixed brief below;
everything labelled **Proposal** is a recommendation, not a newly settled number. Existing
[Training](training.md), [Minigames](minigames.md) and [Constellations](constellations.md) remain the shipped contract
until this draft is approved and implemented. Claude's RPG work is outside this change.

## Reading guide

- [The new loop and fixed brief](#1-the-new-loop-and-fixed-brief)
- [Constellation Levels and tickets](#2-constellation-levels-and-tickets)
- [Catalogue counts and four element distributions](#3-element-identity-and-the-catalogue-check)
- [Roster, parties and independent Puzzle Levels](#4-roster-parties-and-puzzle-progression)
- [Board, combat, skills and enemies](#5-the-puzzle-battle)
- [Chapter maps, fight types and rewards](#6-chapters-and-the-farming-loop)
- [Exchange shop and negative ticket bank](#7-the-exchange-shop) · [migration](#8-preserving-existing-progress-and-the-negative-ticket-bank)
- [Phone experience and icons](#9-screens-guides-and-visual-identity)
- [Persistence, content and delivery](#10-implementation-boundaries) · [review choices](#12-owner-review)

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
| **Uma Puzzles** | **Puzzle Level per outfit; party maps** — proposed ownership | **Scenario/style Constellation Level-Up Tickets** |

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
- Choose and lock an outfit's Puzzle element during roster registration. Review alternatives to the supplied mapping.
- Battles give independent Puzzle EXP. Scenario chapters represent roughly **ten Puzzle levels each**, with regular
  mixed-element squads and mono-element bosses that can be selected for material farming.
- Target **six Umas' worth of scenario CL tickets per five-Uma party's scenario progression**.
- Enemy cast/art comes from **Puzzle & Dragons**, privately imported, not from the Uma catalogue or generic monsters.
- Existing earned scenario levels generate a **one-time negative ticket bank**. Later rewards pay matching debt
  before entering spendable inventory. Existing levels are not reset.

### Proposed first-release scope

Keep the strong existing continuous-drag interaction, but replace solo Drive/Resolve circuits with a real party:
shared HP, healing orbs, element-linked attacks, enemy squads, targeted attacks, individual active skills, one leader
passive, boss phases and a persistent map. Start with one element per Uma and a small readable enemy-mechanic set.

**Proposal: entry and retries are free.** Do not automatically carry over Spark's one daily Training Ticket cost.
The owner requested a global material loop but did not specify its entry price. This is a review choice, not permission
to change the current daily grant or scenario-promotion price.

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

### Ticket eligibility — proposal where the brief needs precision

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

### Option A — the owner's original mapping

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

**Proposal if A wins:** uncovered multi-A outfits choose any basic element, shown as an explicit exception category.
That makes the basic-choice pool 28, but does not silently rewrite the exact supplied predicates.

### Three alternatives

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

**Recommendation: C.** It most directly reduces compulsory Light/Dark, gives launch parties enough Water options,
and leaves the dominant Pace/Late population useful across several teams. B is closer to the owner's example of
Fronts/Ends retaining a rare element even in mixed styles. D preserves more aptitude-specific choice but requires a
more involved explanation. Show owned-roster colour counts during enrollment; suggest an underrepresented eligible
colour without automatically assigning it. No party is required to include one of every element.

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
The draft ties enemy colour to a visible reward discipline as follows, independent of which enrollment option wins:

| Defeated enemy element | Proposed CL ticket family |
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
does not restrict its inventory reward or material spend. This conversion is a review choice.

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

### Stats and leveling — candidate baseline, not pinned

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

Party max HP and RCV are sums of its five members. Growth rates are normalized fractions, not raw percentage integers.
No racing cards, scenario caps or lineage improvements enter these formulas. A leader's bounded passive applies
after summing; explain it in the party preview.

**Proposal: unbounded lifetime PL, no tier reset or hard level-50 cap.** Chapters use ten-level bands:
scenario tier `t` targets PL `10(t − 1) + 1 … 10t`. Today's fourteen chapters cover PL1–140; a fifteenth extends
the band. No class promotion is implied just because RPG has one. Later skills expand by published bands, not an
unbounded stack of permanent multipliers.

Candidate next-level EXP: `100 + 10 × (L − 1)`. Store integer EXP; greedily cross levels and carry surplus.
An ordinary win grants each of the five frozen entrants `round(0.5 × nextLevelExp(enemyLevel) × relativeFactor)`;
guardian weight 1.0, champion 2.0. Use the encounter's authored level, never the sum of enemy levels. Proposed
`relativeFactor = clamp(0.25, 2, 1 + 0.10 × (enemyLevel − memberLevel))`.

These are **starting candidates for a small simulation**, not evidence the fourteen-win path below already reaches
PL10. Tune weights to start a roughly on-level party near the next chapter's band after one primary route. Give all
five entrants the same base award and their own relative adjustment, regardless of how many matching colours they used.
A win earns EXP, not necessarily a whole level; the result shows progress when no level is crossed. Loss/abandon gives
no EXP or material in this proposal; repeat wins still pay.

Show every level crossed with ATK/HP/RCV/guard/resilience deltas. Candidate skill milestones are PL1/5/10 for the
first kit, then one choice at each completed ten-level band. Keep a compact loadout rather than importing the RPG tree.

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
2. Apply Heart healing up to max HP, then any bounded poison penalty; HP reaching zero ends the battle immediately.
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

Each regular row offers two alternative squads; choose one to progress, and reveal the other for optional replay after
that row is reached. This gives **20 regular nodes + 3 guardians + 5 champion nodes = 28 map nodes**, but the primary
route clears **10 regulars + 3 guardians + 1 champion = 14 encounters**. Dark's PC/LS variant is one champion node
with a pre-entry reward choice, not a sixth route. Require all three guardians before Finals; any champion clear marks
the chapter complete, with other routes remaining farmable. Distinguish primary completion from optional full-map clear.

Each regular trio has **exactly one Light or Dark foe and two distinct basic-element foes**, as requested.
Use all six pair/side combinations across a chapter, not just two examples; avoid making all safe paths pay the same
two styles. Basic starter chapter enemy identities can come from the requested early Monster Book families, with
their weaker variants in squads and stronger variants as guardians/champions. Exact cast/art authoring stays private.

Proposed guardian is a mono-element boss; it is not forced to share the party's colour. The final five routes are
Fire/Water/Wood/Light/Dark champions. A node preview gives recommended PL, foe elements, intent recipes, weaknesses,
exact ticket families/quantities and the party's estimated strength. It can warn without forbidding a higher chapter.

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

**Proposal:** a conversion edge becomes available after that party/account has first cleared the higher chapter's
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
avoid style bias but change the matching-material rule; this is an explicit review choice.

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
4. A fractional legacy remainder can be topped up with the equivalent fraction of a future CL acquisition, completing
   a universal ticket while preserving total value. **This needs owner approval:** it complicates integer material
   output. A simpler alternative is a one-time round-up of that final account fraction to one legacy ticket, explicitly
   recorded as migration compensation, at most one per account. Recommendation: the simpler round-up; do not silently
   pretend it is value-neutral or round each unit separately.
5. Conversion/round-up preserves value already owned, so it does **not** count as a new reward that repays the bank.
   Spending a preserved ticket still changes CL normally; it must not re-debit the frozen migration cohort.

For review, the recommended selection is **preserve generic stock + pool remainders + at most one account round-up**.
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

Reuse `PagedGuide`, `createGuideMemory`, contextual first page, shared shells and reduced-motion handling. Proposed pages:

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

Proposed domain concepts, **not a finalized save schema**:

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
local-first `/api/sync` carries bounded entities and idempotent logs; do not resurrect the RPG's retired Sync/Submit UI.

### Resume, conflicts and recovery

Reload on the same device must restore the **exact board, HP, foes, cooldowns, turn and seed**. Content publication or
party edits elsewhere cannot reroll it. Retain engine version dispatch; an unsupported old journal is a visible restore
case, not permission to discard it and give a favourable board.

Device journals do not silently sync. Proposed second-device policy: show the persisted open encounter and its origin,
allow viewing other parties, and require an explicit takeover to restart the **same frozen input/seed from turn zero**
if its local action journal is unavailable. Supersede the prior device with a new attempt revision without another reward
identity; two terminal claims cannot both pay. On reconnect a displaced device shows recovery and keeps its archived
journal for diagnostics. This is an implementation obligation, not something ordinary last-write-wins outfit rows
magically solve. If this cannot be safely implemented local-first, surface the conflict and pause that encounter rather
than granting duplicate progress; approval of a stronger takeover boundary may be needed.

Bank creation is authoritative and one-time; subsequent repayment must retain immutable cohort and prove the movement
toward zero. Do not copy a `max(level)` entity merge for combined ticket spends: it can keep the level while losing the
spend. Result/spend/exchange evidence must reconstruct inventory and reconcile checkpoint/outfit deltas without double
application. Add API shape validators and explicit older-schema refusal; no cloud credentials or infrastructure edits
are part of ordinary engine/UI tasks.

### Private PAD content

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

Separately project a primary route through at least two ten-level chapters, fifty-four gross tickets, recipient-style
coverage, debt-first earnings and exchanges. Check start/end PL, rewards per minute, same-style boss farming and the
13-edge exchange effect. A result that only gets the total 54 right but cannot practically train the roster is not
closed balance. Pin approved constants in the design, domain pinning test, sim envelope and a **new** decision.

### Suggested delivery sequence — unnumbered until review

Each unit gets a detailed task spec after the choices below are approved. Re-check free milestone/task numbers on
latest main; do not consume M030/T106 merely for a draft or reuse completed task numbers.

| Unit | Deliverable and completion boundary |
|---|---|
| **A. Progression/material contract** | Approved CL/source-A rules, four scenario/style items, pure spend/exchange/debt functions, legacy conversion plan and synthetic allocation/migration tests. No live cutover until end-to-end replacement is ready. |
| **B. Party puzzle engine** | Shared board utility extraction where justified; element/Heart/team/target/cooldown/enemy reducer, bounded parsers, fixed-seed hashes and focused combat/progression sim. No rendering in domain. |
| **C. Private cast and campaign** | Generated map/recipe/reward contracts, verified private PAD import/atlas adapter, real opening pack, missing-pack gate and retained-content strategy. No original rows in git. |
| **D. Local-first runtime** | Puzzle outfit/preset/checkpoint storage, device journal, replayed reward host, atomic Items/bank/EXP operations, migration rehearsal, conflict/takeover recovery and API validation. No fake production host. |
| **E. Mobile playable loop** | Home/Hub/roster/party/map, hybrid battle/skills/result, shared guide/practice, exchange/Items, original CL icons and profile/Training spend sheet. Verify real rewards in a save, not only synthetic screenshots. |
| **F. Cutover and closure** | Reviewed one-time cohort, safe legacy conversion, unfinished Spark refunds/route retirement, global terminology/docs/badges pass, content publication, green PR release, production smoke and owner iPhone feedback. |

Code can land behind an explicit unavailable/release gate in smaller PRs. **Do not remove the only working training
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

Current documents already contain older descriptions: Constellations' displayed formula includes `max(baseStat,
50 × TL)`, but Training and `packages/domain/src/constellation.ts` use fixed template base stats (D152). Preserve the
shipped projection and SP progression; do not accidentally reintroduce a stat buff through the rename. Some
training/card prose still says stars are scenario-local, and README/RPG implementation text still references
Persona/engine v2 despite D265's engine v3. Use D255 for global stars and RPG + D265/D266 for current combat/map
facts. Record targeted cleanup in the relevant implementation unit; do not overwrite Claude's current RPG changes
under the guise of the Puzzle draft.

## 12. Owner review

The fixed brief in section 1 is incorporated. The following are the meaningful choices still needing approval;
the proposed formulas are starting candidates for testing, not another long list of requests for arbitrary numbers.

| Choice | Recommendation | Why it matters |
|---|---|---|
| Element registration | **Option C**, pure Front→Light/pure End→Dark; others choose basics, Dirt override first | Makes basic elements broadly available without discarding aptitude identity; B stays closer to the owner's example |
| Five elements → four ticket styles | Fire→FR, Water→EC, Wood→LS, Light→PC, explicit Dark PC/LS variants | Connects enemy drops to all four consumable families without inventing a fifth item |
| Progression ownership and entry | Global **PL per outfit**, five filled slots, free entry/retry; ten-level chapters | Keeps this independent global loop usable without a new daily gate; no RPG class/tier reset |
| Chapter/reward budget | **14 primary-route encounters / 54 gross tickets**, optional branches and repeatable targeted bosses | Six fresh units' worth by total; no false guarantee for every restricted recipient roster |
| Exchange access | Two-way 2:1, same style, adjacent only; open an edge after higher Opening guardian | Preserves the requested exchange while preventing immediate tier-1→tier-14 conversion |
| Existing-level debt | `CL − 1`, one frozen A style per existing scenario unit; matching acquisition repayment | No baseline/preset overcharge; mutable race preferences cannot move old debt |
| Old EXP/tickets | Preserve universals; pool all remaining EXP; one final account round-up at most | Preserves existing effort with a small explicit compensation rather than deleting fractional value |
| First-release battle kit | Shared HP/Heart, one active per Uma, one leader, targeting, simple visible boss counters | Enough PAD depth to feel like a new party game without importing its whole modern complexity |

Once reviewed, settle these choices in the design/decisions, author fully specified tasks, then implement one task to
completion at a time. **This document does not change the deployed app, grant/debit the account, retire Spark, publish
PAD content or claim a phone test has passed.**
