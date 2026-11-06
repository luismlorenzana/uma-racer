# M037 — Careers v2

> **Release 1.1, after M036 (D388) and before roadmap release 2 (Team Showdown).** Planned 2026-11-05 from the
> owner's first playtest of generation 3. Decision **D390** records the plan and its defaults, and **D395** the URA
> Finals as an announced course; the parts are D391–D394 and D396.

## Why

The owner played generation 3's URA Finale and asked for seven changes:
1. **The mini-games:**
   - the match-3 (Training Yard) won't be the main training game, but stays around;
   - every game should pay the same outputs, so they swap freely;
   - Furlong Hand, the Pocket Card Jockey–style game, should be built out as the candidate training game.
2. **Careers with far more racing,** by distance group: Medium · Long, Mile · Medium, Sprint · Mile, with their G1
   crowns.
3. **Distance presets** again: a deck, posts and style per distance.
4. **Training up front,** then racing near her best stats.
5. **Cards locked by scenario.**
6. **A clear answer** on how tickets are earned.
7. **The URA Finals as an announced course** (a follow-up the same day): "Tokyo 2000m, Chukyo 1200m" with variable
   conditions, as the original's Champions Meeting and League of Heroes announce theirs.

## The design

- [Careers v2](../research/careers-v2/README.md): the groups, the four calendars, presets, pacing, tickets, card
  gating, the code map and the defaults. Its visual summary is
  [previews/careers.html](../research/careers-v2/previews/careers.html).
- [Swappable stages](../research/careers-v2/swappable-stages.md): one pay bundle for every game, with Furlong Hand
  first.
- [The URA Finals as an announced course](../research/careers-v2/finale-events.md): a board of courses and
  conditions per calendar, one announced at career start, and the conditions in the race engine.

## The parts

Each part branches `feat/t16x-…` from `main` after the part before it has merged, opens a pull request into `main`,
and merges only on green CI. **Every merge deploys** (the release runbook), so each part is shippable on its own and
the owner can play between them.

| Part | Packet | What | Save |
|---|---|---|---|
| 1 | T160, **built (D391)** | One pay bundle (110 drills, 12 Bond, 25 SP at A); Furlong Hand's drill split; `CAREER_GAMES` (Furlong Hand first, Training Yard second); the rivals' season shares re-measured | No change |
| 2 | T161, **built (D392)** | The Library unlocks only open eras; `return-later-cards` gives back the 6 later-era cards' tickets | One new operation; a card row may carry `returnedAt` |
| 3 | [T164](T164-race-conditions.md) | Ground, weather and season in the race engine: the ground's stat and HP effects, season, weather and ground skills buyable, and the course stat check if the sources confirm it | No change; the engine version goes up |
| 4 | [T162](T162-distance-groups-and-calendars.md) | Distance groups, the four calendars, the training block, crowns paying Card Tickets, the new rival curve, the URA Finals as an announced course | **Protocol 3 → 4**; `restart-careers` restarts the career in progress (tickets, unlocks and bonds kept) |
| 5 | [T163](T163-distance-presets.md) | Per-distance deck, posts and style on T162's `presets` | No change |

T160, T161 and T164 are independent of each other and can run side by side. T162 needs T160 (it retunes the bundle)
and T164 (its Finals' conditions), and T163 needs T162.

## The defaults (D390)

They stand unless the owner objects ([careers v2](../research/careers-v2/README.md) §8):
1. **Qualifying:** A in one distance, B or better in the other.
2. **Careers:** one URA Finale career per Uma, in the group picked at the start.
3. **Training up front:** 10 of 13 plays before her first race.
4. **SP:** stages pay no SP; racing does.
5. **Card Tickets:** paid by crown, not by objective.
6. **Crowns:** they follow the group, not the real horse's sex.
7. **The career in progress** restarts under v2.
8. **The URA Finals' course** is announced at career start: the next on her calendar's board, or any eligible one
   she picks (D395, superseding the distance pick at the Finale).

Plus two calls from the stages and the card gating:
- **`CAREER_GAMES`** offers both games, Furlong Hand first.
- **Later-era cards** are returned by an owner-tapped banner, not a silent migration.

## Done when

- [ ] All five parts are merged and deployed, each verified per the release runbook.
- [ ] The manual describes the game as it runs: pages 01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12, Racing and the
      architecture.
- [ ] The career guide (`docs/design/game-loop/previews/career-guide.html`) is rewritten.
- [ ] D391–D394 and D396 are written.
- [ ] `docs/tasks/README.md` marks M037 released, and this spec and its packets are deleted (D104).
