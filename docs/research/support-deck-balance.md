# Support Deck and Training balance follow-up

Date: 2026-09-17. Task: T010 (spec archived in git history). Every checked-in id, template, effect weight,
skill, stat, and seed is invented. The harness does not read `/content`, private packs, or original-game data.

## Method

Run `pnpm sim:cards -- 300`. The first matrix applies the actual generated card projection and deterministic Training rules
to weak (LB0/Lv1), mid (LB2/Lv12), and mature (LB4/Lv25) six-card tier-3 stat decks. A greedy, reload-stable strategy picks
the facility with the highest currently applied gain until TL10. It reports turns, applied gains, total stat gain, learned
versus available invented hints, and active generated Race Bonus.

The G1 follow-up uses 300 paired deterministic seeds per row, a 12-runner 2,400 m field, the strongest Pace aptitude, full
tier-1 player caps, the pinned player Form curve, a mature synthetic player kit with four card-learned skills, and the
documented four-skill NPC baseline shape. This is intentionally a single sensible matchup rather than T008's broad
all-distance/all-strategy average.

## Results

| Deck | Turns to TL10 | Average applied gain | Total stat gain | Hints learned/available | Race Bonus |
|---|---:|---:|---:|---:|---:|
| Weak | 17 | 135.5 | 2,122 | 4 / 6 | 0.0% |
| Mid | 17 | 164.6 | 2,529 | 3 / 6 | 20.6% |
| Mature | 17 | 212.3 | 3,162 | 5 / 6 | 33.8% |

TL10 timing is controlled by the pinned 36/54 Training EXP values, so card maturity properly separates gain throughput,
hint outcomes, and Race Bonus rather than inventing a faster Training-Level curve. Fixed-seed hint counts are not expected
to be monotonic in one short run; the mature deck still exposes all six possible hints and learned five by TL10.

The sensible G1 row measured **30.3% wins at k=0 and 27.7% at k=9**, versus the aspirational 35%→65%. This confirms that
manual deck building and a mature supported skill loadout alone do not close the target, and the narrower row is not
monotonic. Recommendation: keep the pinned Form and race constants, then revisit the target after scenario promotion,
inheritance, player skill refresh/cost selection, and representative stat allocation exist. No hidden player modifier was
added.
