# Race Mechanics Review (engine v7)

A review of engine v7 (D158) against the original's mechanics, prompted by the owner's front-runner races on
2026-09-30. It explains what the engine does phase by phase, lists where it departs from the original with evidence, and
sets out what each stat buys. No private source rows, names or ids are recorded here.

> **Outcome (2026-10-01):** all five findings are fixed in engine v8 (D231, [Racing — Engine
> v8](../design/racing.md#engine-v8-the-originals-start-corners-and-final-straight)). Fixing the start alone left front
> runners winning 0–5% of races, so v8 also widens the position-keeping bands ×1.9, on purpose, to keep every style
> viable. The sections below describe v7, as reviewed.

## How it was checked

- **The owner's own races.** The 20 most recent races of the owner's front runner (Speed 1,221 · Stamina 1,064 ·
  Power 427 · Guts 765 · Wit 783, front aptitude A) were copied read-only from the cloud save and replayed with
  `simulateRaceV7`. **All 20 replays reproduced the recorded finish times exactly**, so every trace below is what
  happened in those races. Fields averaged 5.3 front runners in 16–18. The copy was deleted after the review.
- **Re-seeded batches.** Each race was re-run on 25 seeds (500 races) to separate a rule's effect from one race's luck.
- **Field balance.** `pnpm sim:turns` (generated 12-runner G1 fields, tier 1) measured each candidate fix.
- **The reference.** Formulas were checked against the torena-sim mechanics notes, the source engine v7 already used
  ([Race Engine v7 Findings](race-engine-v7-findings.md)).

## How a race works

### Target speed and current speed

Every second each runner has a **target speed**, where she wants to be, and a **current speed**, where she is. Below
target she accelerates; above it she slows at a fixed rate (−1.2 m/s² in the opening leg, −0.8 in the middle, −1.0
after). Everything else is a change to one of the two:

| Changes | What they do |
|---|---|
| Strategy and phase, position keeping, the Wit section roll, hills | Move the **target** |
| Velocity (target-speed) skills, Spot Struggle, Secure Lead, Repositioning, duels | **Add to the target** while they last |
| Acceleration skills, duels | **Add to acceleration**, which only acts while current is below target |
| Current-speed skills | Add to **current** speed directly |

So an acceleration skill does nothing to a runner already at her target: before the final leg that is most of the
race. It helps only while she is climbing, which happens at the start, after a slowdown (a block, Pace down, a hill, a
mode ending), when a velocity skill or mode raises her target, and at the start of the final leg. A velocity skill
before the final leg lifts her target by its amount; she climbs to it at her acceleration and drifts back at −0.8 m/s²
once it ends. That is the original's behaviour, and the engine's (`turns.ts`).

### Opening and middle legs

```
target = baseSpeed × style coefficient[phase] × position-keeping coefficient + baseSpeed × section roll + skills
baseSpeed = 20 − (distance − 2,000) / 1,000          20 m/s at 2,000 m
```

**Speed does not count yet.** The opening and middle legs run at the style's pace, so the owner's reading is right:
these legs are decided by position keeping, Wit and skills, not by Speed.

| Style coefficient | Opening | Middle | Final leg |
|---|---|---|---|
| Front | 1.000 | 0.980 | 0.962 |
| Pace | 0.978 | 0.991 | 0.975 |
| Late | 0.938 | 0.998 | 0.994 |
| End | 0.931 | 1.000 | 1.000 |

Position keeping runs through the original's section 10, checked every 2 s:

| Mode | Who | Target | Note |
|---|---|---|---|
| Speed up | Front, in 1st, under 4.5 m ahead (12.5 m if she is the only front) | ×1.04 | Wit roll `20 × log10(Wit / 10)%` |
| Overtake | Front, not first among the fronts | ×1.05 | Same roll; ends 10 m clear of the next front |
| Pace up | Pace, Late, End too far back | ×1.04 | `15 × log10(Wit / 10)%` |
| Pace down | Pace, Late, End too close to the leader | ×0.915 opening, ×0.945 middle | No roll; ends if a speed skill fires |

Front runners are never paced down, as the owner expected. They chase each other instead: every front behind the
leader rolls for Overtake (×1.05) while the leader can only roll Speed up (×1.04) and only while she is close, so with
five or six fronts the lead changes hands constantly. In the owner's races she led the fronts after 15 s in 15% of
races and at the start of the final leg in 50%. That churn is the original's rule: a ×1.05 mode is worth about 1 m/s,
three times a typical velocity skill, which is why fronts without skills still pass one that has them. What makes it
churn **more** than the original is how cheap passing is (finding 3).

### Final leg and last spurt

```
leg pace   = baseSpeed × style coefficient[final] + √(500 × Speed) × 0.002 × distance aptitude
max spurt  = (leg pace + 0.01 × baseSpeed) × 1.05 + √(500 × Speed) × 0.002 + (450 × Guts)^0.597 × 0.0001
```

Speed enters here, twice in the max spurt, and the style coefficient enters too. A front runner's final-leg coefficient
(0.962) is 0.032 below a late runner's (0.994): about 0.67 m/s at 2,000 m once spurting. **A front runner needs about
470 more Speed than a late runner to reach the same top speed** (1,268 against 800), and Speed above 1,200 counts half.
That is the original's design: a front runner wins with the lead she built before the final leg, not with top speed.

In the owner's 17th-place race she began the final leg 7–17 m ahead of the eventual top six, all late and end
runners with 800–920 Speed. Her top spurt was 23.8 m/s; theirs were 23.9–24.1. With Power 427 she took about 14 s to
reach it, against about 10 s for their 590–710 Power, and was blocked on the rail on the way. The engine did what the
original would; the build and the final-leg lanes (finding 2) lost that race.

Acceleration coefficients by style barely differ in the final leg (Front 0.996, Pace 0.996, Late 1.000, End 0.997);
closers catch up through the speed coefficient above, not through acceleration. In the opening leg they differ more
(End 0.945).

## Findings

### 1. The start dash carries everyone to full speed in the first second (departs from the original)

The original adds 24 m/s² of acceleration from 3 m/s **until the runner reaches 85% of base speed** (about 17 m/s at
2,000 m, roughly 0.6 s), then she climbs the rest on her own acceleration: 3 m/s at 0.27–0.46 m/s², 7–11 s, where Power
and early acceleration skills decide who gets to the front. Engine v7 adds the 24 m/s² for the whole first one-second
turn and caps only at the target, so every runner reaches her full opening-leg target in turn 1.

- After turn 1 the fronts in the owner's races stood a mean 0.10 m apart.
- Power has no effect on the start, and an early-race acceleration skill that fired in turn 1 in 16 of her 20 races
  (+0.4 m/s² for 1.2 s × distance/1,000) never changed anything. The same holds for every acceleration skill that fires
  in the opening seconds, including the "after several early skills" kind the owner noticed.
- **With the original's rule** (cap the dash at 85% of base speed, integrate the rest exactly), she led the fronts
  after 5 s in 85% of races instead of 40%: her early skill started to work.
- **But on its own it moves balance hard.** Every runner now climbs, and fronts climb the most because their opening
  target is the highest. In `pnpm sim:turns` front-runner wins fell to 0–5% at every distance (from 18, 20, 25, 5
  and 15% at 1,200–3,000 m) and End won 33–58%. Her own wins in the re-seeded batch fell from 55% to 33% (Power 427 now costs her at the start
  too). The current bug has been propping front runners up, which means something else in the engine favours
  closers (finding 3). The two have to change together.

### 2. Runners return to the rail through the final corner and the final straight (departs from the original)

Engine v7 drifts every runner with clear space 0.2 lanes a second toward the rail, all race. In the original a runner
stops returning to the rail once the final corner begins: on entering it she sets an extra target lane of
`clamp(lane / 0.1, 0, 1) × 0.5 + random(0.1)` course widths, which spreads the field out for the straight.

- On the final straight the owner's runner stepped inward 97 times and outward 24 times across her 20 races, and was
  blocked 22 times in the final leg, 9 of them on the straight: drift in, block, swing out, drift in again.
- **With inward drift stopped from the final corner on**, blocks in the final leg fell from 0.68 to 0.25 a race, her
  mean place improved from 4.63 to 4.12 and her top-3 rate from 65% to 68%. In `pnpm sim:turns` wins by style moved
  within the sim's noise (40 races a row), and blocked time fell or held at every distance.
- This is the owner's fourth observation, and it is a clean fix that stands on its own.

### 3. Passing costs nothing (departs from the original)

In the original, a runner wide on a corner runs farther: lanes add distance through the corner geometry, roughly 2 m per
horse lane on a 180° turn. Engine v7 measures every runner along the rail, so running wide is free. A blocked runner
also swings 1–3 lanes in a single turn, and v7's own "going round" rule moves a faster runner out before she reaches a
slower one. Blocked time is about 1 s a race per runner at 2,000 m.

The result is that closers pass the pack at no cost, the field's late and end runners win more than the style table
implies, and only the start bug (finding 1) gives front runners their lead back. In the original, going round the
field on the final corner is the closer's risk. **Charging the corner distance by lane is the counterweight finding 1
needs**; lane-change speed should be rechecked at the same time.

### 4. Skill conditions the engine cannot read

4% of skill groups in the owner's fields (106 of 2,383) can never fire because a condition variable is unsupported.
The most common: `is_activate_other_skill_detail` (38), `straight_front_type` (20), `order_rate_out40_continue` (11),
`succession_skill_count` (10), `is_used_skill_id` (10). One of them is the first group of the owner's runner's own
unique: its final-leg acceleration and speed, top two only, depends on `straight_front_type` (which straight she is on).
Only its second, mid-race speed group can fire (12 of 20 races). Supporting `straight_front_type` needs each straight's
type in the course layout; `is_activate_other_skill_detail` needs a record of which skills fired.

### 5. One-second turns round skill durations

A skill lasts `round(base × distance / 1,000)` whole turns: a 1.2 s skill runs 2 s at 2,000 m (2.4 s in the original)
and 3 s at 2,200 m (2.64 s). Up to half a second either way per skill. Minor; an effect can expire part-way through its
last turn.

### What was checked and matches the original

Style speed and acceleration coefficients, deceleration rates, the final-leg and max-spurt formulas, Guts' terms, the
HP model and style HP coefficients, the spurt plan and its Wit acceptance, position keeping's modes, rolls and
thresholds, Spot Struggle, Secure Lead, Repositioning, Stamina keep, Wit's skill activation, the section roll, start
delay, and stats above 1,200 counting half.

## What each stat buys

At 2,000 m (base speed 20 m/s), on the engine's formulas:

**Speed** — counts only from the final leg: `√(500 × Speed) × 0.002` to leg pace and again to max spurt.

| Speed | 600 | 800 | 1,000 | 1,200 |
|---|---|---|---|---|
| Front max spurt (Guts 600) | 22.83 | 23.18 | 23.49 | 23.76 |
| Late max spurt (Guts 600) | 23.50 | 23.85 | 24.16 | 24.43 |

About +0.15 m/s of top speed per 100 Speed near 1,000, falling with the square root; above 1,200 each point counts
half.

**Power** — acceleration `0.0006 × √(500 × Power)` (× style, surface and distance aptitude): the start (once finding 1
is fixed), the climb to max spurt, recovering after a block, hills (`slope% × 200 / Power` m/s lost) and how far a
blocked runner swings out.

| Power | 400 | 600 | 800 | 1,000 | 1,200 |
|---|---|---|---|---|---|
| Final-leg acceleration, front (m/s²) | 0.267 | 0.327 | 0.378 | 0.423 | 0.463 |
| Time to climb 3 m/s to max spurt | 11.2 s | 9.2 s | 7.9 s | 7.1 s | 6.5 s |
| Ground lost against an instant climb | 16.8 m | 13.7 m | 11.9 m | 10.6 m | 9.7 m |

From 400 to 800 Power is worth about 5 m in the final leg alone, two lengths, before acceleration skills.

**Stamina** — max HP `0.8 × style coefficient × Stamina + distance` (front 0.95). It decides whether she holds a full
spurt; past what the race needs it buys nothing below 2,200 m, and above 1,200 it adds the stamina contest's speed on
2,200 m and longer. About 700 holds a full spurt at 2,000 m, 1,000 at 2,400 m, 1,400 at 3,000 m
([Race Engine v7 Findings](race-engine-v7-findings.md#realistic-rivals-d159)).

**Guts**

| Guts | 400 | 600 | 800 | 1,000 |
|---|---|---|---|---|
| Max spurt term (m/s) | 0.14 | 0.18 | 0.21 | 0.24 |
| Duel speed / acceleration | 0.30 / 0.07 | 0.40 / 0.09 | 0.48 / 0.10 | 0.57 / 0.12 |
| Spot Struggle speed, duration | 0.15 for 6 s | 0.19 for 8 s | 0.23 for 9 s | 0.26 for 10 s |
| Spurt HP cost multiplier | ×1.41 | ×1.33 | ×1.29 | ×1.26 |

Guts matters most in duels on the final straight and in a crowded front.

**Wit** (× strategy aptitude)

| Wit | 400 | 600 | 800 | 1,000 | 1,200 |
|---|---|---|---|---|---|
| Skill activation | 78% | 85% | 89% | 91% | 93% |
| Front position-keeping roll | 32% | 36% | 38% | 40% | 42% |
| Takes a slower spurt plan when short of HP | 35% | 45% | 55% | 65% | 75% |
| Notices it is short of HP (Stamina keep) | 48% | 54% | 61% | 67% | 73% |

The section roll's ceiling rises from +0.12% to +0.45% of base speed over the same range: small. Wit's value is in
skills firing.

### The owner's front runner, read against this

- **Power 427 is the weak stat.** It costs about 5 m against an 800-Power closer in every final leg, and once the
  start is fixed it will cost the opening too.
- **Speed 1,221** sits at the 1,200 halving point; the next 100 buys about 0.07 m/s.
- **Stamina 1,064** is about 350 more than 2,000 m needs: she finished the 17th-place race with 19% HP left. It
  pays from 2,400 m.
- **Guts 765 and Wit 783** are healthy: 89% skill activation and strong duels.

For 2,000 m races, moving Stamina into Power would gain the most.

## What engine v8 did with them

Every rule change went into a new engine version (v8, D231), so the owner's v7 records keep replaying exactly.

1. **The final corner and straight (finding 2):** a runner holds her lane from the final corner on. The original's
   "extra move lane" spread was left out: the reference's formula for it is ambiguous, and holding the lane alone cut
   the owner's final-leg blocks from 0.68 to 0.11 a race.
2. **Skill conditions (finding 4):** 22 more variables, including `straight_front_type` (each straight's front type now
   travels with the race's course) and two-stage skills. Unsupported groups fell from 11.8% of the pack to 2.4%.
3. **Start and passing (findings 1 and 3):** the original's start dash with exact in-turn physics, and the ground a
   runner off the rail gives up on a corner. Slowing lateral swings was tried and dropped: it added blocking for every
   style, front runners included, and weakened skills. The bands ×1.9 restore the style balance.
4. **Exact skill durations (finding 5).**
