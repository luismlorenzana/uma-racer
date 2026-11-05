# Racing

The race itself and its rivals: how a grade's rivals are handicapped, how strong a career's fields are at each point of
its calendar, and how the rivals are rolled. Code: `packages/race` (the engine), `packages/domain/src/opponents.ts` (the
rival rolls and handicaps) and `tiers/rivals.ts` (each scenario's and season's field). Design:
[racing.md](../design/racing.md).

What a race pays, and how a career's races are prepared and settled, is [03](03-careers.md) §4–§6.

| Topic | Page |
|---|---|
| A career's objectives, the race's runner, seed and settle, the URA Finals | [03](03-careers.md) §4–§5 |
| The racing build a race reads | [05](05-the-build.md) §7 |
| Rival strength by scenario | [04](04-tiers-and-scenarios.md) §5 |
| The career's targets and `sim:careers` | [12](12-pacing.md) |
| The engine, determinism and the race scene | [Architecture](architecture.md#the-race) |

## Race presentation

**Art (SB6, D373).** Race presentation uses each outfit's bust: the pre-race runner and field, PixiJS runner tokens,
feed, result hero and finishing order. The scene loads only verified `bust` images in runner order, holds them while
playing and falls back to gate numbers if unavailable. Small Uma-selection controls and the shared picker use faces;
only the Town Hall plaza uses chibis. No result, reward, seed, playback timing or race rule changes.

## Rival handicaps

A race's rivals race weaker than the typical trained Uma by their grade's handicap, a share of every stat, so a grade
is equally soft at every tier (D152, D155). G1 is the real test, and each grade below is softer. `sim:careers`
re-tuned them in D383 so that a career played once at grade A with a median deck wins its G3s, G2s and G1s at least
90%, 75% and 50% of first tries ([12](12-pacing.md) §2). A career races only G3s, G2s and G1s; the lower grades keep
the ladder. The URA Finals' final sets its own, smaller handicap ([03](03-careers.md) §5).

<!-- live:rival-handicaps -->
| Grade | Rival handicap |
|---|---|
| Debut | 45% |
| Maiden | 45% |
| Pre-OP | 40% |
| OP | 40% |
| G3 | 38% |
| G2 | 22% |
| G1 | 17% |
<!-- /live -->

## Rivals

**Strength.** A field is built on its scenario's **typical trained Uma** ([04](04-tiers-and-scenarios.md) §5): at URA
Finale, the typical career's average stat at its Finale, measured by `sim:careers` (D383). In a career, the field is as
strong as **the typical career at the race's season**: the trained stat × the season's share, then less the grade's
handicap. So a Junior race's rivals are as green as she is, and a Senior G1's are nearly trained. The shares are the
typical career's average stat in each season over its average at the Finale (a median deck, every stage played once
at A); Junior Spring's is set lower, since she races there on her base stats, before any Training Yard, and the fields'
stamina-first presets would outlast her. A race outside a career uses the full trained stat.

<!-- live:rival-seasons -->
| Season | Share | Field stat before the handicap (T = 1) |
|---|---|---|
| Junior Spring | 0.150 | 84 |
| Junior Summer | 0.357 | 200 |
| Junior Autumn | 0.440 | 246 |
| Junior Winter | 0.496 | 277 |
| Classic Spring | 0.536 | 300 |
| Classic Summer | 0.621 | 347 |
| Classic Autumn | 0.678 | 379 |
| Classic Winter | 0.743 | 415 |
| Senior Spring | 0.758 | 424 |
| Senior Summer | 0.860 | 481 |
| Senior Autumn | 0.899 | 503 |
| Senior Winter | 0.981 | 548 |
| Finale | 1.000 | 559 |
<!-- /live -->

**The roll** (D153, D159). Rivals are generated per race. Each running style gets a preset: Stamina first, from what
the race's distance needs, then the rest spread by distance and style. Each stat is then rolled within a range of the
preset, and each rival draws her skills.

<!-- live:rivals -->
| Rule | Value |
|---|---|
| Rivals per running style | 2–5 |
| Each rolled stat | 80%–100% of her style's preset |
| Skills per rival | 3–7 |
| Stamina reference, sprint | 1,400 m |
| Stamina reference, mile | 1,800 m |
| Stamina reference, medium | 2,400 m |
| Stamina reference, long | 3,200 m |
<!-- /live -->

- Every rival is a different real Uma, cast to the slot whose style suits her best, and races with her own unique at
  level 5 beside her drawn skills.
- The draw is seeded by the race: the same attempt rolls the same field on every device.
