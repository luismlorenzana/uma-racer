# Open Questions

No item currently waits on the owner. The game rework is built and shipped: its rules in phase 2
(D340–D351), the new game on generation 2 in phase 3 (D352–D361, released by T144 on 2026-10-15), and the canvas Hub
with its own art (T145, D363, D364). New questions land here with a recommendation, get resolved in the same session
where possible, and then move to the [decisions log](decisions.md). The state of the plan is [tasks](tasks/README.md).

The game's numbers are pinned in domain tests, and [the manual](game/README.md)'s live blocks render them from the
code. `pnpm sim:loop` measures the pacing ([the rework modules](game/architecture.md#the-rework-modules)).

## Needs you

None. The owner explicitly authorized T144's follow-up retirement on 2026-10-21 alongside A04 and SE1 (D362).
That removes the temporary purge capability; it does not rerun the old purge or reset the current account. Physical
iPhone/PWA checks remain the owner's validation, not a claim of automated device acceptance.

Archived (D370): whether the whole interface moves to a pixel-art look. It stays in `git show 3236188:docs/open-questions.md`; if you want it, it's a "Both apps:" request ([change protocol](change-protocol.md)).

## Done

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- ✅ The Home Screen app is installed on the iPhone and signed in
  ([GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy)).
- ✅ Phase 3's start of the new game: the owner said go, and the cutover deployed and wiped the old save once
  (T144, 2026-10-15).

- ✅ T144 follow-up authorized 2026-10-21: temporary purge endpoint/call retired; audit markers and current account retained (D362).

### Closed by the wipe (D339)

The device checks that waited here are retired, not done: phase 3 deleted or replaced every system they covered. They
were Milestones 3–6's race, Cards, Deck, Collection, Journey and Badge feel, Spark Rival Circuit, the Stable Farm,
Extra stats, the first playable RPG and Uma Puzzles. Their protocols stay in git history (`git show afe4696:docs/open-questions.md`).
The Farm production and Uma Puzzles definition reviews that sat here are closed the same way (D326).

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).
- **World Expeditions content** (phase 9): about 89 course layouts and 70 local champions, authored privately by Claude
  and reviewed by the owner region by region ([rework/10](rework/10-expeditions.md)).
- **Push notifications** (phase 4) come only if you ask for them after playing (D336).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
