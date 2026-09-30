# Open Questions

Earlier shipped-system design questions have been resolved and logged in [decisions.md](decisions.md). The proposed
[Global Uma RPG](design/uma-rpg.md) has new questions below; none should be treated as an implemented rule. Draft
numbers across the design docs (curves, costs, thresholds) are **tuning values**, not open questions. They get adjusted
through balance simulation and playtesting.

## Global Uma RPG — resolve before implementation

| Question | Recommended first answer / validation |
|---|---|
| Is the party **five** rather than four, and must all five be filled? | Prototype both at 390×844. Lead with five full slots and five saved presets, with no mandatory class composition; the starter pack has only one End-A outfit. |
| How do **surface aptitude**, B-distance elements and an outfit with no A running style affect class/skill eligibility? | Use source aptitudes rather than editable racing defaults; explicitly design the off-surface and no-A fallbacks before coding. Do not silently drop Turf/Dirt. |
| Which element is an outfit's active signature, and what exactly does its draft **10% class bonus** modify? | Choose one from its permitted elements in setup; do not double-apply to hybrid damage. Simulate the bonus and elemental multiplier together, then pin the settled constants. |
| What are the RPG level cap/curve, HP/MP formulas, skill tiers/slots, healing and KO rules, chapter length and weak/strong enemy EXP adjustment? | Build a synthetic combat-and-progression sim before adopting numbers. Keep Speed as both ATK and MATK input. |
| What happens when a chapter is open on one device and the player switches preset, edits that outfit elsewhere, reconnects on another device or reinstalls? | Freeze each entered battle, sync clear checkpoints and idempotent rewards, and write down an explicit second-device policy. Never silently reroll an open fight. |
| Which PriConne characters/monster variants, fighting styles and art are authored for production? | Start with a small named-guest/boss shortlist and ordinary synthetic foes; keep all extracted/third-party rows and images in private content. A missing pack must be visible. |
| What is the scenario Parent Unlock item's exact name, clear quantity, repeatability and eventual consumption? | First delivery grants only an auditable global Item stack; coordinate the later sink with the separate Inspiration design. Do not let this draft alter constellation gates. |
| Is chapter entry free, and can a failed or abandoned chapter be retried without cost or map reset? | Lead with free entry and explicit retry/checkpoint rules; decide and pin before implementing the save contract. |

## Needs you (owner actions, not design questions)

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- **On your iPhone:** install the Home Screen app and sign in once. See [GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy).
- **Milestone 3 device feel:** run one race from the installed Home Screen app in portrait and landscape, including Skip and
  a result CTA. Desktop emulation verifies layout/behavior, but not safe-area feel, 120 Hz pacing, or physical touch targets.
- **Milestone 4 Cards device feel:** scroll the complete Cards album, change both filter rows, open/close a long detail
  sheet, and perform one real limit break from the installed Home Screen app. Desktop emulation verifies the 390×844
  layout and behavior, but not physical safe-area/scroll/touch feel.
- **Milestone 4 Deck device feel:** edit a tier-1 Uma deck on the installed app, exercise reorder/remove/filters/Auto fill,
  then open Training and Race Select. Desktop emulation verifies validation and layout, but not physical drag-free thumb
  ergonomics or the complete offline/reconnect flow on iOS.
- **Milestone 4 Collection device feel:** inspect Stable All/Owned/Unowned, exchange five shards, redeem one Card and one
  Uma Coupon, and reload each reveal on the installed app. Desktop emulation verifies the 390×844 layout, atomic local
  state, and direct-route behavior, but not physical safe areas, reduced-motion preference, or iOS offline/reconnect feel.
- **Milestone 5 Scenario/Journey device feel:** start and promote one Uma, inspect the Home tracker and Profile Journey,
  follow a target into Race Select/pre-race, and complete a goal through Results on the installed app. Also check one missed
  Journey and reduced motion. Desktop validation covers rules and persistence, but not physical safe-area, scrolling,
  animation timing, or offline/reconnect feel on iOS.
- **Milestone 6 Badge/Trainer device feel:** scroll/filter all three scopes, open a long detail/timeline, pin/reorder
  several awards and Umas with touch and accessible controls, edit the Trainer name/showcase, inspect records and both
  recent-flair surfaces, and test reduced motion plus offline/reconnect. Desktop validation covers the 390×844 layout and
  persistence, but not physical drag/scroll ergonomics, standalone safe areas, or long-list feel on the owner's iPhone.
- **Spark Rival Circuit device feel (M022):** play an authored three-wave run from the Home Screen app, including
  fast/edge drags, background/resume, Spark Shift, loss, clear and opened-node links, in normal and reduced motion.
  Browser emulation cannot prove finger occlusion, Safari pointer cancellation or sustained 60/120 Hz pacing. The full
  protocol and trace budget were T074's (`git show 7129d77:docs/tasks/T074-spark-rival-polish.md`); M022 itself is
  complete (D189).
- **Stable Farm device/offline feel (M025):** assign and plant on the installed Home Screen app, close it, reopen after
  the real deadline, harvest, follow the result into Items, reload offline, then reconnect and verify the same stack on
  sync. Browser/test-clock validation covers every state and transaction but not a physical twelve-hour iOS lifecycle.
- **Produce-node device feel (M026):** on the installed app, fill one empty Produce node, replace one Legacy/current
  assignment, verify the Item quantity and stat strip move together, then reload offline/reconnect. Browser validation
  covers the two phone layouts, transaction rollback and stale-screen behavior, but not physical thumb/VoiceOver feel.

These device checks now belong to **T038** in [Milestone 11](tasks/M011-game-feel-and-device.md), which closes them as one
acceptance pass rather than leaving nine separate reminders open.

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).
- **Playability notes:** the owner is playing the current build; each note is fixed as it arrives and logged as its own
  decision (D189 retired T023, the task that was meant to collect them).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
