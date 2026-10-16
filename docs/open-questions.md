# Open Questions

Two items wait on the owner, each with a recommendation. The game rework is built and shipped: its rules in phase 2
(D340–D351), the new game on generation 2 in phase 3 (D352–D361, released by T144 on 2026-10-15), and the canvas Hub
with its own art (T145, D363, D364). New questions land here with a recommendation, get resolved in the same session
where possible, and then move to the [decisions log](decisions.md). The state of the plan is [tasks](tasks/README.md).

The game's numbers are pinned in domain tests, and [the manual](game/README.md)'s live blocks render them from the
code. `pnpm sim:loop` measures the pacing ([the rework modules](game/architecture.md#the-rework-modules)).

## Needs you

1. **Is the new account yours?** Say so in chat once the installed app shows your generation-2 account (the Stable
   with the Umas you unlocked, your Prize Money, the Sync chip clear). That confirmation runs T144's step 10: Claude
   removes the one-release purge endpoint (`POST /api/legacy/purge`) and the boot's purge call, deletes M034's and
   T144's specs, and writes the release decision (D362). The purge already ran (30 collections, 3,676 documents), so
   nothing else is lost or changed by it.
   **Recommendation:** confirm after your first full check-in and race on the iPhone; there is no reason to wait longer.
2. **Should the whole interface move to a pixel-art look,** not only the Hub's maps? Today the maps, buildings,
   currency marks and tier crests are uma-art's pixel art, and every Page, sheet and panel is the DOM's "Paddock" skin
   ([visual system](design/visual-system.md)).
   **Recommendation:** not yet. Keep Paddock for Pages and sheets, where reading and 44 pt targets matter most, and
   decide after a few weeks of playing with the Hub. If you want more pixel art then, start with one ChatGPT
   calibration packet (panel frames, buttons and a sheet in uma-art's style, tried on one place) before any rollout
   ([handoff](handoff/README.md) "Later, not ready").

## Done

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- ✅ The Home Screen app is installed on the iPhone and signed in
  ([GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy)).
- ✅ Phase 3's start of the new game: the owner said go, and the cutover deployed and wiped the old save once
  (T144, 2026-10-15).

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
