# 09 · Furlong Hand

> **Status: as released (M036, D388; T156, D385).** The rules, bots and view are T156's; the career screens (T158) open
> it for a season with an objective and for the Finale, and the Hub's Furlong Hand place opens it as practice. The
> design is M036's "Furlong Hand" and [04](../research/drawing-board/04-mini-game-evaluation.md) §2.2. The framework it
> runs on is [07](07-stages.md).
> **Our rules are original:** none of Pocket Card Jockey's rules, names or art.

**Race.** A card race on her next objective's real course: chain cards by colour or one step up, run them for ground
or bank them for Drive, end each leg in her running style's band, and win the spurt against real Umas. It pays
**Bond** and **SP**, and it never changes the real race.

Code: `packages/domain/src/stages/furlong/` (setup, rules and bots) and `apps/web/src/stages/furlong/` (the view).

## 1. The race

A play's config carries the race (`stages/config.ts`, `stages/furlong/setup.ts`), built alike on the device and the
API from the career and the content:
- **The race:** her season's first objective (the season's stage, [03](03-careers.md) §3), else her next objective
  after this season, else the URA Finals' course (at the Finale, or once every objective is behind her). Practice
  outside a career runs the URA Finals' course for her best surface and distance on her base stats.
- **The legs** come from the real layout (`course-layout.ts`): the race cut into equal stretches, **Sprint 3, Mile 4,
  Medium 5, Long 6** legs and then the **spurt**. Each stretch's terrain is a **climb** when a quarter of it runs
  uphill, else a **corner** where corners outrun straights, else a **straight**.
- **Her:** her racing build ([05](05-the-build.md)): each stat as a share of the season's typical trained Uma (the
  rivals' own reference, [Racing](racing.md)), her distance and style aptitudes, her best style, and her skills: her
  unique first, then the golds she bought, then the whites.
- **The field:** eight real Umas, one a character and never her, cast by `rollRivalFieldAt` and `castRivals` from the
  race's grade and her season, seeded by the stage's seed (two of each style). A rival's strength is its mean stat over
  the typical one.

<!-- live:furlong-numbers -->
| Rule | Value |
|---|---|
| A leg's spread | 4 columns 3 deep, and a pile of 8 (its first card the lead) |
| The spurt's spread | 4 columns 4 deep, and a pile of 8 |
| Legs before the spurt | Sprint 3, Mile 4, Medium 5, Long 6 |
| A run card's yield | 2 points (10 ground a point; a length is 125), +1 on its ground (Speed on a straight, Power on a corner or climb, Guts in the spurt), +1 on the rail's favoured colour, +1 Speed outside, ± half a point a stat class, × its colour's Training Effectiveness and Stat Bonus × 4% |
| Her stat class | −1 under 85% of the season's typical trained Uma, 0 to 110%, +1 to 135%, +2 above |
| A Partner | +1 point run; at bond 80 (60 if kindred) a rainbow: the next 2 cards of its chain yield double, once a spread |
| A Skill card | +2 points (a gold or her unique +4) on its own ground; 1, 2, 3, 4 of them by her Wit class |
| Breath | 13 + her Stamina class + her distance aptitude + 1 a 40 of the deck's Initial stats (2 at most; 15 in all); a flip costs 1, the outside 1, a leg out of band 1; 3 at least for the spurt |
| Drive | +1 a bank, +1 a chain of 4, +2 a clean spread, +1 a leg in band, +1 a 10 of the deck's Race Bonus at the spurt; at most 40; the spurt runs × (12 + Drive) / 12 |
| Bands | Front 1–2, Pace 2–4, Late 4–7, End 6–9 |
| A peek at the next spread | a front card a 60 of the deck's Hint Frequency, one more at Wit +1 |
| The field | 8 rivals; 340 ground a leg and 1080 the spurt at strength 75, form +24% to −24%, a surge or fade ±50, 15 for each card she leaves; never more than 10 lengths clear at a leg's end |
| Later spreads | deal 1 Partner she hasn't played yet |
| The tasks (all four with a win: S) | 2 lengths clear, 2 clean spreads, every Partner played, every leg in band |
| Rules version | 1 |
<!-- /live -->

## 2. The deck

About 40 cards, shuffled again for every spread from the stage's seed:
- **Stride cards** in the five stat colours, valued 1–6: 15 base cards (three a colour) and three of each deck card's
  type. A Friend or Group card's three are **wild**: they follow any lead, and any card follows them.
- **Partners:** her six support cards, each in its type's colour (Friend and Group wild), drawn with the card's art.
- **Skill cards:** her skills, as many as her **Wit** class deals (one to four), each in its skill's colour (speed-ups
  Speed, recovery Stamina, acceleration Power).

Practice without a deck deals stand-in stride cards in the six deck slots.

## 3. A leg

1. **The line** comes first (§4). Then the leg opens: the spread is **four columns three deep, face up**, and the
   draw pile's first card turns over as the **lead**; seven draw cards stay.
2. **Chain:** play a column's front card if it is the lead's **colour** or **exactly one higher** (6 is followed by
   1). It becomes the lead.
   - **Tap to run it** for ground: its colour's yield (§5).
   - **Swipe it down to bank it** for +1 Drive (or turn **Bank** on and tap).
   - A chain of **four** cards pays +1 Drive, once a chain.
3. **When stuck,** flip a draw card as the new lead, for **−1 Breath** (never below 0). A flip starts a new chain.
   At 0 Breath, **Speed and Power yields halve**; Guts keeps its full yield.
4. **The free redraw:** once a spread, before any card is played or flipped, she may deal the spread again (its second
   deal) for nothing.
5. **The leg ends** when the spread is clear (a **clean** spread: +2 Drive) or the pile is out and nothing plays. Each
   card left lets every rival gain.
6. **The field moves:** each rival gains its pace for its strength and form, plus its shown move (§6), and she is
   placed by ground (she takes a tie). **Her band:** ending a leg in her style's places pays +1 Drive; outside it
   costs −1 Breath.

## 4. The line

Before every spread, the gate's included, she picks a line with one of three large buttons:
- **Rail:** the spread's favoured colour +1 (Speed on a straight, Power on a corner or climb). When a rival shows
  **closes the rail** for that spread, column 1 starts **shut** until a Power or Wit card (or a wild one) is played.
- **Middle:** as it comes.
- **Outside:** Speed +1 and −1 Breath; never shut.

At the line choice she sees the next spread's front cards she may **peek** at (§5's Hint Frequency and Wit), the
rest face down.

## 5. Yields and her deck's effects

A run card's yield is in half points: 2 points base, +1 on its ground (Speed on a straight, Power on a corner or
climb, Guts in the spurt), +1 for the rail's favoured colour or the outside's Speed, **± half a point a stat class**
(−1 under 85% of the typical stat, +1 from 110%, +2 from 135%), then × (100 + its colour's percent) %. A Partner runs a
point more; a Skill card on its own ground two more (a gold or her unique four). Stats move her yields a little; play
decides.

**Her deck's real effects** (05 §1's ids), each read at full level:

| Effect | In the race |
|---|---|
| Training Effectiveness (8), Stat Bonus (3–7) | Its colour's yield percent: the card's Training Effectiveness plus 4 a Stat Bonus point; a Friend or Group card's Training Effectiveness adds half to every colour |
| Specialty Priority (19) | The chance, in percent, its Partner is dealt into the first spread |
| Friendship (bond 80) | Its Partner is a **rainbow**: played, it lights the next two cards of its chain, which yield double when run (outside the spurt's Drive); a flip puts it out; a rainbow lights once a spread |
| Hint Frequency (18) | A front card of the next spread shown at the line choice per 60 of the deck's, one more at Wit +1 |
| SP Bonus (30) | SP the first time its Partner is played, on top of the grade's pay |
| Race Bonus (15) | +1 Drive at the spurt per 10 of the deck's |
| Initial stats (9–13) | +1 starting Breath per 40 of the deck's, at most 2 |
| Unique effect | One ability (§7) |

**Breath** starts at 13, + her Stamina class, + her distance aptitude (S +2, A +1, B 0, C −1, D or worse −2 or −3),
+ the deck's Initial stats, at most 15. **Drive** counts to 40.

## 6. The field and fairness

- **Every rival's next move is always shown** under its face: **surge**, **hold**, **fade** or **closes the rail**,
  one a spread from a seeded script by its style. Front runners surge early and fade late; closers fade early and
  surge in the spurt. Every style gains alike over a race; the scripts only shape where.
- **Every field is as strong:** its form runs a ladder from +24% to −24% in even steps, dealt to the rivals by the
  seed, so only who is strong changes.
- **The slip:** at a leg's end no rival is more than ten lengths ahead of her.
- **Her second wind:** at the spurt her Breath is at least 3, so no run of bad deals in the legs empties the spurt.
- **Every Partner gets a chance:** each later spread deals a Partner she hasn't played yet.
- **One free redraw a spread**, and **a loss still pays** (grade D).

## 7. Abilities

Each Partner's card maps its unique effect to one ability: the first term of the unique that maps, a plain effect by
its id, a conditional by the effect it boosts (101 and 106 the effect in `params[0]`, 102 Training Effectiveness,
109–117 the effect in `value`, 121 Initial Friendship), except the deck make-up conditionals (103, 105, 120), which
are team play. A card with no unique has none.

<!-- live:furlong-abilities -->
| Ability | What it does | From a unique that boosts |
|---|---|---|
| Kindred | a rainbow from bond 60, not 80 | effect 1 |
| Second wind | played, +1 Breath | effect 2, 25, 28, 31 |
| Long stride | run, +2 points | effect 3, 4, 5, 6, 7, 41 |
| Fresh legs | +2 Breath at the start | effect 9, 10, 11, 12, 13 |
| Kick | played, +2 Drive | effect 15, 16 |
| Scout | played, shows the next spread's front cards | effect 17, 18 |
| Quick start | dealt into the first spread's front row | effect 19 |
| Study | played the first time, +2 SP | effect 30, 32 |
| Team play | wild: plays on any lead, and any card follows it | effect 14 (and the deck make-up conditionals 103, 105, 120) |
| Rhythm | its chain counts 2 more toward the chain's Drive | effect 8 |
| Inside line | played, opens a blocked column | effect 26, 27 |
<!-- /live -->

## 8. The spurt and the finish

After the last leg's end the deck's Race Bonus adds Drive and she finds her second wind; she picks a line, and the
**spurt** deals its own spread, **four columns four deep**. **Drive multiplies every run card:**
× (12 + Drive) / 12. Banking a spurt card is still +1 Drive for the cards after it. When the spurt's spread ends, the
field runs its spurt (its pace, strength and form, its shown move twice over, growing with the legs it ran), and the
**finish order** is her ground against theirs.

## 9. Grade, tasks and pay

- **The score** is her place. `p` follows from the finish so the framework grades it: a win is 1 (and a hundredth a
  length clear, under 1.2), 2nd–3rd B, 4th–5th C, 6th and on D ([07](07-stages.md) §2).
- **Four bonus tasks** (all four with a win: S): won **2 lengths clear**, **two clean spreads**, **every Partner
  played**, **every leg in band**. The packet's "a win by 2 lengths with all three tasks" is these four together.
- **The pay** is Furlong Hand's at A, **25 Bond and 20 SP** ([12](12-pacing.md) §1), × the grade's multiplier, and the
  Partners' SP Bonus on top. Practice pays nothing.

<!-- live:furlong-grades -->
| Finish | p | Grade |
|---|---|---|
| 1st, 2 lengths clear or more, with every task | 1 + a hundredth a length clear | S |
| 1st | 1 + a hundredth a length clear (under 1.2) | A |
| 2nd | 0.875 | B |
| 3rd | 0.75 | B |
| 4th | 0.625 | C |
| 5th | 0.5 | C |
| 6th | 0.375 | D |
| 7th | 0.25 | D |
| 8th | 0.125 | D |
| 9th | 0 | D |
<!-- /live -->

<!-- live:furlong-pay -->
| Grade | Bond | SP |
|---|---|---|
| S | 30 | 24, and each Partner's SP Bonus the first time it plays |
| A | 25 | 20, and each Partner's SP Bonus the first time it plays |
| B | 20 | 16, and each Partner's SP Bonus the first time it plays |
| C | 15 | 12, and each Partner's SP Bonus the first time it plays |
| D | 6 | 5, and each Partner's SP Bonus the first time it plays |
<!-- /live -->

## 10. The bots and the bands

- **Novice:** the first legal card, always run; flips when stuck; always the rail; never redraws.
- **Competent:** greedy on the chain (the card whose greedy chain runs longest), banking only when running would carry
  her ahead of her band's places (as the rivals' shown moves will leave them); the spurt it runs. The rail unless a
  rival closes it, then the middle; a redraw for a spread whose best greedy chain is under two cards.
- **Expert:** a short look-ahead (the card that starts the longest chain the spread holds, Partners not yet played
  first), the same band banking with a margin, banking the spurt's first cards while a long chain follows, the
  outside when the rail is shut and Breath allows, and a redraw for a spread whose longest chain is under four.

`pnpm sim:stages`, 500 seeds a bot (D385). Seed n plays Uma n's objectives and URA Finals in turn, at their seasons,
on the typical career's stats in her own shape, with the median deck and 0–3 cards at bond 80:

| Content | Novice median | Competent median | Expert S | A play |
|---|---|---|---|---|
| Private pack | 0.875 (B) | 1.010 (A), 70% wins | 52.0% | 98 moves, 4.9 minutes |
| Invented content | 0.750 (B) | 1.000 (A), 56% wins | 47.2% | 92 moves, 4.6 minutes |

By distance the competent bot's play runs 3.4–3.5 minutes on a sprint, 4.2 on a mile, 5.0 on a medium and 5.8 on a
long race. **Fairness, measured:** on an A-target race (one build, race and field, the competent bot winning about
half its deals), six competent-level plays (the competent and expert bots, three dice each) win 82–93% of the deals,
and the best of them never finishes more than about five lengths behind; `furlong/bots.test.ts` pins at least 80%
and under six lengths.

## 11. On the screen

`apps/web/src/stages/furlong/FurlongView.tsx`, DOM and Motion, its own lazy chunk:
- **The top 40% is the race:** the heat's race and distance, the **leg strip** (straight, corner, climb, then the
  spurt; the spread under way marked), the **place ladder**, 1st on the left, with her face (ringed) and the rivals'
  (uma-kit's album faces), each rival's **next move** under its face (surge, hold, fade, closes the rail, each an icon
  with words) and her band's places shaded, and **her bust** with her place, her gap to the leader in lengths, her
  band, and her **Breath** and **Drive** (with the spurt's multiplier).
- **The bottom 60% is her hand:** before a spread, the **line** as three large buttons with what each does and the
  peeked front cards; in a leg, the **spread** (cards behind the front show their top), the **lead**, the draw count,
  **Flip −1**, **Bank** and **Redraw (free)**, the chain and any rainbow.
- **Cards:** stride cards on their stat colour's ground with the stat's icon and their value; wild cards on the Friend
  tile; Partners as their support card's art with their type and value (a spark for an ability), framed in the five
  stat colours once bonded; Skill cards with the skill's name.
- **Tap a front card to run it; swipe it down to bank it** (or turn Bank on). Cards that don't follow the lead are
  dimmed and take no tap; a shut column says so.
- **The spurt has its own moment:** a dark banner, "The spurt", with Drive's multiplier, scaling and fading in
  (transform and opacity only; reduced motion keeps it still).
- The result card says "Finished 2nd" and the four tasks. Every target is 44 pt or more at 390 × 844, in light and
  dark tokens.

## Not built yet

- **Hint drops:** 04's table has a Partner in a chain of four drop a hint for one of its skills. The slice pays Bond,
  whose tracks give the hints ([06](06-cards-and-bonds.md)), so the race drops none.
