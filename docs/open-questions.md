# Open Questions

**None.** The game rework is built: its rules in phase 2 (D340–D351) and the new game on generation 2 in phase 3
(D352–D361), which ships with T144 ([tasks](tasks/README.md)). New questions land here with a recommendation, get
resolved in the same session where possible, and then move to the [decisions log](decisions.md).

The game's numbers are pinned in domain tests, and [the manual](game/README.md)'s live blocks render them from the
code. `pnpm sim:loop` measures the pacing ([the rework modules](game/architecture.md#the-rework-modules)).

## Needs you (owner actions, not design questions)

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- **On your iPhone:** install the Home Screen app and sign in once. See
  [GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy).
- **Phase 3's start of the new game** (T144): the cutover deploy wipes every save once, so it waits for your "go" in
  chat on the day, after the rehearsal passes. Then restart the installed app when it shows "Update ready", and check
  the new account on the phone against [rearchitecture/07](rearchitecture/07-data-reset.md) §7 and
  [rework/13](rework/13-removals-and-plan-changes.md) §9.

### Closed by the wipe (D339)

The device checks that waited here are retired, not done: phase 3 deleted or replaced every system they covered. They
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
