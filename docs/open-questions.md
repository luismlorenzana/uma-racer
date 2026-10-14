# Open Questions

**One:** the stamina ladder at a tier's first scenario (below). The game rework is approved (D336, and D338 for the
Gym), and the plan is in [tasks](tasks/README.md). New questions land here with a recommendation, get resolved in the
same session where possible, and then move to the [decisions log](decisions.md).

Draft numbers across the design and rework docs are tuning values until they are pinned in domain tests and a
decision. The rework's numbers are tuned by `pnpm sim:loop` in phase 2 ([M033](tasks/M033-rework-rules.md)).

## Needs your decision

### The stamina ladder at a tier's first scenario (T133, D349)

**What was measured.** `pnpm sim:rework-builds` runs today's stamina ladder on the rework's full-layer builds at every
scenario, 30 races a check in 12-runner G1 fields. It holds everywhere except three checks, all in a tier's first
scenario. The ladder asks for a full spurt in 27 of 30 races, at pace and at late:

| Scenario | Check | Stamina | Full spurts in 30 (pace · late) |
|---|---|---|---|
| URA Finale (T1) | A miler, her Extra Stats on Stamina, runs 1,800 m | 561 | 1 · 1 |
| Project L'Arc (T6) | The same | 658 | 8 · 17 |
| URA Finale (T1) | A medium set with a Power card runs 2,400 m | 1,014 | 23 · 28 |

**Why.** A tier's first Gym layer has one Extra Stats node per stat, so a miler there can't lean her Extra Stats on
Stamina: her set is the sprinter's. At URA Finale today's six Extra stats gave a medium runner 240 Stamina and 120 Guts;
the rework's first layer gives 60 of each. Design Your Island (T11) holds, on its bigger nodes. From each tier's second
scenario the Duos and Suns open and the lean returns. The trees and the activation rule can't change this, and the
handicaps stay as they are (D336). The rest is on track: every career cell meets its target at every scenario
([rework/03](rework/03-uma-progression.md) §9).

**What holds instead.** Leaning the stamina card one more node runs 1,800 m in 30 of 30 races at T1 and T6 (Stamina
759 and 909). At T1 the two-Stamina-card set runs 2,400 m in 30 of 30, and the Power card set still runs 2,200 m.

**Recommendation: accept it as the ladder's shape in a tier's first scenario.** There a miler leans her stamina card
one node, as a medium runner does, and at URA Finale a 2,400 m race takes the long set. Nothing in the rules changes.
If you agree, the three checks leave `LADDER_OPEN_MISSES` (`@racer/domain/rework/builds`) with a decision row, and the
ladder's page says so ([rework/05](rework/05-training-hub.md) §12). The other way is a rule change: let a tier's first
five Gym singles be any stats, which brings back today's ladder but adds a choice to every first Gym session (05 §6,
D338).

Until you decide, the sim reports the three as open and still fails on any other miss.

## Needs you (owner actions, not design questions)

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- **On your iPhone:** install the Home Screen app and sign in once. See
  [GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy).
- **Phase 3's start of the new game** (later): restart the installed app when it shows "Update ready", then check the
  new account on the phone against [rearchitecture/07](rearchitecture/07-data-reset.md) §7 and
  [rework/13](rework/13-removals-and-plan-changes.md) §9.

### Closed by the wipe (D339)

The device checks that waited here are retired, not done: phase 3 deletes or replaces every system they covered. They
were Milestones 3–6's race, Cards, Deck, Collection, Journey and Badge feel, Spark Rival Circuit, the Stable Farm,
Extra stats, the first playable RPG and Uma Puzzles. Their protocols stay in git history (`git show afe4696:docs/open-questions.md`).
The Farm production and Uma Puzzles definition reviews that sat here are closed the same way (D326).

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).
- **World Expeditions content** (phase 9): about 89 course layouts and 70 local champions, authored privately by Claude
  and reviewed by the owner region by region ([rework/10](rework/10-expeditions.md)).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
