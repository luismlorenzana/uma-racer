# 12 · Pacing

> **Status: as released (M036, D388); the numbers are T154's (D383), the one stage bundle T160's (D391).** The stages
> that pay them are T155's ([07](07-stages.md) and [08](08-training-yard.md), D384) and T156's
> ([09](09-furlong-hand.md), D385). The targets are M036's.

How much a career earns, and how fast. There is no clock: pacing is what each play pays, against what the tree, the
bonds and the skills cost, and how strong the rivals are at each point of the calendar.

Code: `packages/domain/src/career/pay.ts` (the table), `career/rewards.ts` (the races), `career/sim.ts` (the sim) and
`tiers/rivals.ts` (the fields).

## 1. What a play pays

Every stage pays into the career's wallet ([05](05-the-build.md) §1) on every play: **one bundle for every game**
(D391), at grade A times its grade's multiplier (D 0.25, C 0.6, B 0.8, A 1.0, S 1.2: [07](07-stages.md) §2), so the
games swap for each other in a season. Practice pays nothing.

<!-- live:career-pay -->
| Game | Drills | Bond | SP |
|---|---|---|---|
| Every game | 110 | 12 | 25 |
<!-- /live -->

- **A game decides only how its drills split** across the five colours, and adds nothing of its own:
  - **Furlong Hand**, the main game, by the ground she ran in each colour, a wild card's in the season's focus
    ([09](09-furlong-hand.md) §9);
  - **Training Yard** by the drills it scored in each (its pieces' Sweat and its merges, [08](08-training-yard.md)
    §6).
- **Bond and SP** are pools the owner spends by hand: Bond into the deck's tracks, SP on skills.
- **Races** pay on an objective's win ([03](03-careers.md) §6): a Card Ticket, and SP by grade × (1 + the deck's Race
  Bonus).
- **The tree's sessions** pay SP of their own, by the original's formula ([05](05-the-build.md) §4).

`STAGE_PAY_AT_A` is the one table the stages' settle reads (`settle-stage`, [07](07-stages.md) §3), so a re-tune
changes one number.

## 2. The targets

A career played **once through, every stage at grade A, with a median deck**:
- buys **about 60%** of the tree (its 108 sessions, Camps included);
- brings **about 3 of 6** deck cards to bond 80;
- earns SP for **4–6 skills**, counted as golds with their whites (a gold and its white at hint level 1, at the
  content's median price): the skills a build is planned around. In whites, that's about ten;
- and **one replay of each season's play fills the tree.**

Its races, first try:
- a median deck wins **G3s at least 90%**, **G2s 75%** and **G1s 50%** of the time, and the URA Finals final **about
  half** the time;
- a strong deck wins more races in all.

The tree, the bonds and the skills are ceilings, not the plays: replays pay like first plays, and a player who replays
more reaches them sooner.

<!-- live:career-targets -->
| Target | Private pack (local) | Invented content (CI) |
|---|---|---|
| G3 first tries won (median deck) | ≥ 90% | won and lost |
| G2 first tries won | ≥ 75% | won and lost |
| G1 first tries won | ≥ 50% | won and lost |
| URA Finals finals won | 40%–60% | won and lost |
| A strong deck | wins more races in all | wins more races in all |
| Tree bought | 55%–65% | 45%–75% |
| Deck cards at bond 80 | 2.5–3.5 | 1.5–4.5 |
| SP earned, in golds with their whites | 4–6 | 3–7 |
| Tree bought with one replay of each season's play | ≥ 95% | ≥ 90% |
<!-- /live -->

## 3. The sim: `sim:careers`

`pnpm sim:careers` plays every Uma's URA Finale career with a median and a strong deck (`sim:decks`' picks,
[05](05-the-build.md) §10), every stage at grade A, by a fixed allocation bot:
1. **Pay:** each season, and the Finale, pays one play of the main game at A, the bundle. The sim models Furlong
   Hand's drill split by the race's cards: three base strides a colour, and each deck card's three strides and Partner
   in its type's colour, a Friend or Group card's in the season's focus.
2. **Bond** goes into the deck card nearest to 80, stat cards first, then on to 100.
3. **Drills** buy each branch's next pip while its colour pays; a full branch's colour buys a Camp there.
4. **SP** buys golds first (with the white beneath), then the cheapest skill that races, while it pays.
5. **Races:** each objective, and each URA Finals round, runs three first tries on the real engine; retries being
   free, the career then goes on as if it was won, and its reward is paid.

It prints the first-try win rates by grade and round, the pacing, where SP came from, and **the typical career's
average stat at each season**, from which the rivals' season shares are set ([Racing](racing.md#rivals)). It fails
when a target misses.

- **Locally** it reads the private pack (`MASTER_DIR`, or `../uma-platform/content/release`; the racer's overlay from
  `CONTENT_DIR` or `./content`) and holds the targets above. It prints aggregates only; the results go in the PR and
  in D383 as shares.
- **In CI**, `pnpm test` and `pnpm test:ci` end with `pnpm sim:careers -- --synthetic`: invented Umas, races, courses,
  skills and cards (`career/synthetic.ts`). Their cards are weaker than the pack's, so the rates are only checked for
  sense (every kind of race sometimes won and sometimes lost, a strong deck winning more) and the pacing bands are
  wider. The domain's tests run the bot without the engine.
- `--attempts=n` races each objective n times (default 3); `--umas=n` plays the first n Umas' careers (every Uma still
  races as a rival).

## 4. How the numbers were set (D383, D391)

- **M036 (D383)** paid each game its own table: Training Yard 200 drills and 30 SP in the seasons without an
  objective (about seven a career), Furlong Hand 25 Bond and 20 SP in the others. 260 drills had bought about 70% of
  the tree, and 60 Bond brought five cards to 80, since the tracks start at their cards' real Initial Friendship
  Gauge.
- **The bundle (D391)** spreads that over every play: 13 a career (twelve seasons and the Finale), so **110 drills,
  12 Bond and 25 SP** a play pay about what M036's career did (1,430 drills to its 1,438, 156 Bond to its 145, 325 SP
  to its 332). 100 drills bought 57% of the tree but lost too many G2s; 120 bought 67% and won too many finals.
- **SP** stays as the rules give it otherwise: the races' 40, 60 and 100, and the tree's own. A career earns about
  1,400 SP, which is five golds with their whites, or ten whites: the original's economy, kept.
- **The rivals** are tuned against this career ([Racing](racing.md#rivals)). Paying every season spreads her growth
  evenly over the calendar, where M036's Training Yard seasons came early, so D391 re-measured their season shares
  from this sim's curve.
