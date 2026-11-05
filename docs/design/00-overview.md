# Overview

> **As built: generation 3, M036's URA Finale (D380, D388).** The vision, the pillars, the loop and how Uma Racer
> differs from the original game, in brief. The design in full is [the drawing board v3](../research/drawing-board/README.md),
> with its research and roadmap; the rules as they run are the manual, [docs/game/](../game/README.md), whose README
> holds the game in one page. This page doesn't repeat either.

## Vision

A pocket-sized Uma Musume racing game where **every Uma's career is played, not waited on**. Each season of a career is
a short mini-game drawn in Uma art, a few minutes of upgrading her by hand with what it paid, and her objective races on
the race engine. The original's support cards bring their **real numbers** to her training, so a deck is built the way
the original's is, and a finished career leaves her racing build on her profile.

## Design pillars

1. **No clock, no limits.** Nothing runs on timers, refills overnight or resets daily, and there's no energy, mood or
   rest. The more you play, the more you unlock (D380).
2. **Active training.** Resources come from mini-game stages of 3–7 minutes, graded D to S, each Uma-themed and
   replayable at any time. No audio is needed, no heavy tapping, nothing as heavy as a puzzle RPG.
3. **Deterministic building.** The owner spends resources by hand in her tree. Every pip shows its exact gain, priced
   with the original's training formula and the cards posted to that branch, before it is bought. Nothing is random.
4. **The real cards.** SSR support cards count at their top level with their real effects, train where they're
   posted, and grow a bond track with each Uma. Their values stay in the private pack.
5. **Races can be lost, and retried for free.** Rivals are real Umas, handicapped by grade and as trained as the
   season says. A G1 is the real test.
6. **History unfolds in order.** The original's fifteen scenarios in release order, three tiers of five; a card joins
   careers from its own era on. Every mechanic is open from scenario 1, and scenarios differ by caps, objectives,
   rivals, card era and finale.

## The core loop

```text
unlock Umas and cards (tickets) ──▶ start a career ──▶ each of 12 seasons:
                                                        Play (a stage) ──▶ Upgrade (tree · deck · bonds · skills) ──▶ Race
                                                        └──────────────────── replay any time ◀───────────────────────┘
                                    ──▶ the finale (URA Finals) ──▶ her racing build, and tickets for more
```

- **Unlock** with Uma and Card Tickets in the Stable and the Card Library ([02](../game/02-unlocks.md)).
- **Play** Training Yard (drills) or Furlong Hand (Bond and SP) for the season ([07](../game/07-stages.md)).
- **Upgrade** in her tree, deck, bond tracks and skills ([05](../game/05-the-build.md), [06](../game/06-cards-and-bonds.md)).
- **Race** her objectives, and win the URA Finals to complete the career ([03](../game/03-careers.md)).

It all happens on the Hub's two pages, Town Hall and Career, each a pixel-art map (uma-rpg's Hub, on uma-art) with the
game's own DOM skin over it ([11](../game/11-hub-and-places.md), [UX](ux.md), [Visual System](visual-system.md)).

## How this differs from the original game

| Original game | Uma Racer |
|---|---|
| A career is turns of training with RNG, mood and energy | A career is **12 seasons of mini-game stages**, each graded and paying resources spent by hand; no mood, energy or rest |
| Training gains are rolled each turn | Every gain is **previewed exactly** from the training formula and the posted cards' real effects |
| Gacha for Umas and cards, limit-broken by duplicates | **No gacha.** One ticket unlocks an Uma or an SSR for good, at its top level; careers pay the tickets |
| Career goals end the run when failed | **Retries are free**; an objective must be won before the season ends |
| Daily limits and timed events | **No clock** of any kind |
| Each scenario adds its own mechanic | **Every mechanic is open everywhere**; scenarios differ by caps, objectives, rivals, card era, finale and themed stages |
