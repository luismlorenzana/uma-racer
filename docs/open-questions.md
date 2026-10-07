# Open Questions

Earlier shipped-system design questions have been resolved and logged in [decisions.md](decisions.md). The owner's
Global Uma RPG answers are now incorporated in the [RPG design draft](design/uma-rpg.md) and D219–D221. No RPG
question here blocks reviewing that draft. Turf/Dirt does not gate elemental trees. D250 supersedes the one-token draft: regular fights grant skill tokens and a boss grants slot tokens; each completed scenario chapter funds five outfits' six slots and twelve golds. Its remaining HP/MP
coefficients, depth gates, active-slot count, private
PriConne content selection and phone layout are **implementation/balance checks**, not unanswered owner choices;
[RPG implementation contract](technical/uma-rpg-implementation.md) records the implemented boundaries and acceptance checks. The planned RPG
sync policy (D223) lets battle actions work offline but holds entry/result rewards as pending until a grouped
commit is acknowledged; T090–T092 now implement that boundary, and any later change needs a new decision. Draft numbers across the design docs are tuning values
until pinned in domain tests and a decision.

## Uma Puzzles — first-draft review

The owner's global-party/ticket rework is captured in [Uma Puzzles](design/uma-puzzles.md), not yet approved or
implemented. Its [review table](design/uma-puzzles.md#12-owner-review) keeps recommendations and unresolved choices
together: counted element mapping, five-element/four-style drops, outfit PL/free entry, chapter budget, exchange
access, one-time debt allocation and preservation of old tickets/partial EXP. No current save or shipped number changes
while these are under review. PAD source art access is also an explicit content-verification requirement, not a completed import.

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
- **Extra stats device feel (D235):** on the installed app, buy one Extra stat node, switch two on and off, verify the
  Item quantity and stat strip move together, then reload offline/reconnect. Browser validation covers the phone layout,
  transaction rollback and stale-screen behavior, but not physical thumb/VoiceOver feel.
- **First playable RPG (D257):** the owner explicitly requested production-first release, not a pre-merge iPhone gate.
  Follow the [standing production/device checklist](research/rpg-release-acceptance.md#owner-productioniphone-protocol--post-release-feedback)
  for real-party balance, rewards/debt, Inspiration spends, reload/offline and second-device takeover. Publication and
  deployment evidence are separate from this still-pending physical-iPhone acceptance; no synthetic proof signs it off.

These device checks now belong to **T038** in [Milestone 11](tasks/M011-game-feel-and-device.md), which closes them as one
acceptance pass rather than leaving nine separate reminders open.

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).
- **Playability notes:** the owner is playing the current build; each note is fixed as it arrives and logged as its own
  decision (D189 retired T023, the task that was meant to collect them).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
