# Open Questions

Every earlier design question has been resolved and logged in [decisions.md](decisions.md) (see D49–D58).


Draft numbers across the design docs (curves, costs, thresholds) are **tuning values**, not open questions. They get
adjusted through balance simulation and playtesting.

## Needs you (owner actions, not design questions)

- ✅ Google Cloud and Firebase are set up and deploys are enabled (2026-09-15).
- **On your iPhone:** install the Home Screen app and sign in once. See [GCP Setup Guide — Part 7](technical/gcp-setup-guide.md#part-7--install-on-your-iphone-after-claude-confirms-the-deploy).
- **Race device feel:** run one race from the installed Home Screen app in portrait and landscape, including Skip and
  a result CTA. Desktop emulation verifies layout/behavior, but not safe-area feel, 120 Hz pacing, or physical touch targets.
- **Training/minigame device feel:** open the Training scene, configure the card set and constellation, play Spark Match,
  refresh during a board, and confirm the same board returns and the result moves the real Training Level. Launch Bond
  Recall from a set card, verify its scenario bond and per-node value increase, and confirm Done returns to that set.
- **Collection device feel:** inspect Stable All/Owned/Unowned and the Cards Collection/scenario lenses; unlock one card
  with tickets or a Card Select Coupon; exchange five shards and redeem one Uma Coupon; reload each reveal. Desktop
  emulation verifies state and direct routes, but not physical safe areas, reduced motion, or iOS offline/reconnect feel.
- **Scenario/Journey/lineage device feel:** start one Uma's scenario, inspect its Home/Profile goals, follow a target into
  Race Select and Results, advance at a gate, and at TL9–10 configure parent/grandparent constellation nodes. Also check
  one missed Journey and reduced motion.
- **Badge/Trainer device feel:** scroll/filter all three scopes, open a long detail/timeline, pin/reorder
  several awards and Umas with touch and accessible controls, edit the Trainer name/showcase, inspect records and both
  recent-flair surfaces, and test reduced motion plus offline/reconnect. Desktop validation covers the 390×844 layout and
  persistence, but not physical drag/scroll ergonomics, standalone safe areas, or long-list feel on the owner's iPhone.

These device checks now belong to **T038** in [Milestone 11](tasks/M011-game-feel-and-device.md), which closes them as one
acceptance pass rather than leaving six separate reminders open.

## Not questions, but still to come

- **Data research:** facts to gather from the original game, tracked in the [data backlog](research/data-backlog.md).
- **Playability notes:** the owner is playing the current build; their notes become T023 in
  [Milestone 7](tasks/M007-align-and-stabilize.md).

## Process

If a new question comes up, it goes here with a recommendation, gets resolved in the same session where possible, and
then moves to the decisions log.
