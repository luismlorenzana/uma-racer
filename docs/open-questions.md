# Open Questions

The game rework is approved (D336, and D338 for the Gym), and the plan is in [tasks](tasks/README.md). The stamina
ladder at a tier's first scenario took its recommendation (D350). `pnpm sim:loop` left two checks of
[rework/12](rework/12-economy-and-pacing.md) §12 that no tuning lever fixes without breaking another (D348): they need
you, below. New questions land here with a recommendation, get resolved in the same session where possible, and then
move to the [decisions log](decisions.md).

Draft numbers across the design and rework docs are tuning values until they are pinned in domain tests and a
decision. The rework's numbers are tuned by `pnpm sim:loop` in phase 2 ([M033](game/architecture.md#the-rework-modules)).

## Needs your decision

- **Tier 1's scenarios aren't even, though the tier is on target.** The loop simulation measures tier 1 at 20.3 weeks
  (your 19–23), but its scenarios at 38, 30, 23, 24 and 22 days against the 24–32 the check asks of each. A new
  account's first scenario starts cold: every building at Lv 1, every Uma at Farm Lv 1, an empty Warehouse, and no
  Prize Money until the first careers are raced, so the first upgrades land around day 31. After that the roster is
  25, every building reaches Lv 3 by about day 65 and Prize Money buys Speed Tickets, so a scenario takes about three
  weeks. The time factor moves every scenario the same way, and the only layer size left to move is scenario 1's six
  bonds, which fill her first preset. **Recommendation:** keep the rules and read the pace as it is: check tier 1 at
  19–23 weeks, its first scenario within 6 weeks, and each later scenario at 20–32 days. If you'd rather feel four even
  weeks, the alternative is a gentler start, such as a new account's Kitchen and Pantry at Lv 2 on day 0.
- **The Pantry runs at the 90% ceiling.** Its four slots at Lv 2 and 3 are held 81–91% of the time in the busiest
  scenario windows, depending on the seed (91.5% in tier 3 on the committed one). The planner fills them at nearly
  every check-in, since crafting is the step with the most items. Slot counts aren't a tuning lever. **Recommendation:**
  give the Pantry a fifth slot at Lv 2 and Lv 3, as the Vegetable Garden has; the sim then measures its peak at 80%.
  It also shows that the tiers-2-and-3 check sits on its edge: with the fifth slot their quickest scenario measures 18
  days against the 20-day floor (20.0 on the committed run), so that floor would want the same reading as above.

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
