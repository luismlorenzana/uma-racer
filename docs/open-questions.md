# Open Questions

Earlier shipped-system design questions have been resolved and logged in [decisions.md](decisions.md). The proposed
[Global Uma RPG](design/uma-rpg.md) has new questions below; none should be treated as an implemented rule. Draft
numbers across the design docs (curves, costs, thresholds) are **tuning values**, not open questions. They get adjusted
through balance simulation and playtesting.

## Global Uma RPG — resolve before implementation

| Question | Recommended first answer / validation |
|---|---|
| Is the party **five** rather than four, and must all five be filled? | Prototype both at 390×844. Lead with five full slots and five saved presets. **No class quota**: Front and End are recommended in one composition, not required, and End receives no exception. |
| How do **surface aptitude**, B-distance elements and an outfit with no A running style affect class/skill eligibility? | Use source aptitudes rather than editable racing defaults; explicitly design the off-surface and no-A fallbacks before coding. Do not silently drop Turf/Dirt. An eligible running-style class is chosen once and locked for the outfit; only elemental affinities branch thereafter. |
| Within a locked Pace or Late running style, may an outfit **change weapon path at promotion**? | First draft keeps one selected weapon path across tiers, so mastery and legacy loadouts remain coherent. A later intra-style switch could be allowed only with explicit rules for old skills and new-tree eligibility; it must never create parallel running-style EXP tracks. |
| Which element is an outfit's active signature, and what exactly does its draft **10% class bonus** modify? | Choose one from permitted elements in setup; it never limits other equipped elements. Simulate the bonus, physical-element rider and advantage together, then pin settled constants. |
| Does the candidate **repeatable Lv1–50 class-tier curve, permanent-stat formula and elemental-tree ladder** feel rewarding, and what are HP/MP, healing, KO, chapter length and level-relative EXP rules? | Test five-scenario promotion pacing and at least two full tiers in a synthetic combat-and-progression sim. Promotion cannot lower stats or lose banked EXP. Keep Speed as both ATK and MATK input. |
| What are the exact **tree-point, depth-gate, skill-level, legacy-loadout and active-slot** rules? | Lead with one point at even tier-local levels (2…50), five depths per eligible weapon×element cell, meaningful target/hit/support branches, A-only capstone and useful lower-depth B-side options. Simulate specialization against breadth before pinning counts. |
| What happens when a chapter is open on one device and the player switches preset, edits that outfit elsewhere, reconnects on another device or reinstalls? | Freeze each entered battle, sync clear checkpoints and idempotent rewards, and write down an explicit second-device policy. Never silently reroll an open fight. |
| Which **playable PriConne character teams**, adapted affinities, phases and portraits are authored for production? | Research lists a sourced shortlist and candidate opening chapter. Validate image links/variants on the official character site, then author one complete private chapter before expanding. Keep all extracted rows and art in private content. A missing pack must be visible; monsters are not the default enemy cast. |
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
