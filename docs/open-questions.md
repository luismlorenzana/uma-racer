# Open Questions

**None.** The game rework is approved (D336, and D338 for the Gym), and the plan is in [tasks](tasks/README.md). The
last one, the stamina ladder at a tier's first scenario, took its recommendation (D350). New questions land here with a recommendation, get resolved in the
same session where possible, and then move to the [decisions log](decisions.md).

Draft numbers across the design and rework docs are tuning values until they are pinned in domain tests and a
decision. The rework's numbers are tuned by `pnpm sim:loop` in phase 2 ([M033](tasks/M033-rework-rules.md)).

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
