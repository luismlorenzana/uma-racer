# Race Engine v7 Findings

Research behind engine v7 (D158) and the realistic rivals (D159). The owner's brief: **every stat matters as it does in
the original, and skills decide races**. A runner with 400 less Speed and several skills that fire should beat one
with none. No private source rows, names or ids are recorded here.

## Sources and how they were used

- [torena-sim mechanics notes](https://github.com/jalbarrang/torena-sim/blob/main/docs/mechanics/README.md): the
  community's full-field mechanics reference, with replay-data amendments. Used for Spot Struggle, Repositioning,
  Secure Lead, Stamina keep, position keeping, lane-change speed and the spurt re-plan after a heal. GPL-3, so it was
  **read for the formulas only**: every line in `packages/race` is our own. Formulas and constants are facts about
  the original game.
- [Game8: 位置取り調整](https://game8.jp/umamusume/547551) confirms that Repositioning reads Power and Guts.
- [shimahokke's note](https://note.com/shimahokke_uma/n/n5499dffced04) and the kamigame stat pages
  ([1](https://kamigame.jp/umamusume/page/410548423234709823.html),
  [2](https://kamigame.jp/umamusume/page/233107458644552772.html)) cover what each stat does after the 2.5th
  anniversary, and the unique-skill level table.
- [Race Engine v5 Findings](race-engine-v5-findings.md) already verified the core formulas that v7 keeps.

## Why v6 could not deliver the brief

v6 (D155) multiplied the Speed term by 2.5 and counted it from the middle leg, doubled acceleration and cut the HP
rate to 0.85. Speed then decided races on its own: +300 Speed put a runner first every time, and +300 in any other
stat moved her one or two places. A 1,000-Speed runner with a Lv5 unique, a gold speed skill, a gold acceleration skill
and two whites, all firing, **never** beat a 1,400-Speed runner without skills (0 of 80 races). In the original the
same kit is worth about 16 m at 2,000 m against about 11 m for 300 effective Speed, so the skilled runner should win.

## What each stat does in v7

v7 returns the physics to the original's and adds the field mechanics v6 and v5 left out. The clock stays the turn
clock of v6 (one-second turns, race-wide phases).

| Stat | Where it counts |
|---|---|
| **Speed** | Target speed from the final leg, `√(500 × Speed) × 0.002` (the original's; v6 counted it from the middle leg at 2.5×). Max spurt adds it twice |
| **Stamina** | Max HP `0.8 × style coef × Stamina + distance`, so whether she holds a full spurt; the stamina contest above 1,200 |
| **Power** | Acceleration `0.0006 × √(500 × Power)`, at the original's rate (v6 doubled it). Hill loss `slope% × 200 / Power`. How far a blocked runner swings out. Repositioning |
| **Guts** | Minimum speed; spurt HP rate `1 + 200 / √(600 × Guts)`; max spurt `(450 × Guts)^0.597 × 0.0001`; duels; Spot Struggle; Secure Lead; Repositioning |
| **Wit** | Skill activation `max(100 − 9000 / Wit, 20)%`; section roll; spurt acceptance; downhill mode; every position-keeping roll; noticing a short HP (Stamina keep); Repositioning when far back |

### Position keeping (the original's, through section 10)

v6's style bands are replaced by the original's modes, from the start-of-turn field. In normal mode she checks every
2 s. A mode ends when its goal is met or after one section, and then 1 s passes before the next check.

| Mode | Who | Enters | Target | Ends |
|---|---|---|---|---|
| Speed up | Front, in first | Less than 4.5 m ahead of second (12.5 m if she is the only front runner), on a `20 × log10(Wit / 10)%` roll | ×1.04 | More than that ahead |
| Overtake | Front, not first of the fronts | A `20 × log10(Wit / 10)%` roll | ×1.05 | 10 m ahead of the next front runner |
| Pace up | Pace, Late, End | Further behind the leader than her band's far edge, on a `15 × log10(Wit / 10)%` roll | ×1.04 | Back inside a random point of the band |
| Pace down | Pace, Late, End | Closer to the leader than her band's near edge, with no speed skill running | ×0.915 opening, ×0.945 middle; −0.5 m/s² and HP ×0.6 | Back past a random point of the band, or a speed skill fires |
| Pace up Ex | Anyone out of place: a later style ahead of a front runner, or leading a later style | Always | ×2 (the original's; capped at 30 m/s) | No later style ahead |

Bands, from the leader, scale with `0.0008 × (distance − 1000) + 1`: Pace 3 m to 5 m × scale, Late 6.5 to 7, End
7.5 to 8.

### Spot Struggle (位置取り争い)

Once anyone has run 150 m, and until section 6 ends, the front runners within 3.75 m and 0.165 of the course width of
the frontmost front runner all enter it together, once a race. Each gains `(500 × Guts)^0.6 × 0.0001` m/s (0.19 m/s at
600 Guts) for `(700 × Guts)^0.5 × 0.012 × style aptitude` s (about 8 s at 600 Guts), and spends HP 1.4× as fast. It
ends at section 9, when its time runs out, or for one who falls 5 m behind every other struggler, or 0.416 of the
course width away from all of them. Once everyone else has left that way, the last one stops too; if her time simply
runs out, the others carry on.

### Competing before the spurt (sections 11–15)

Every 2 s she may push for 2 s, then rests 1 s. Each push costs `20 ×` her style's HP coefficient `×` the course's
(0.3 up to 1,800 m, 0.5 to 2,100 m, 0.8 to 2,200 m, 1.0 to 2,400 m, 1.1 to 2,600 m, 1.2 beyond).

- **Stamina keep (持久力温存)** comes first. If her HP is short of what a full spurt from the final leg needs, with a
  1.035–1.04× margin rolled once, and she notices, she sits every push out until a heal resets it. The chance to notice
  is `30% × (Wit / 1,000 + Wit^0.03)` (the community marks this formula speculative): about 45% at 300 Wit, 54% at
  600 and 67% at 1,000. A low-Wit runner may keep pushing and come up short.
- **Secure Lead (リード確保).** A Front, Pace or Late runner whose lead over a later style is below
  `margin + 0.0003 × (distance + 1,000)` m tries on a 20% roll (the original's Wit scaling is unknown). Margins: Front
  over Pace 4, over Late or End 8; Pace over Late 5, over End 6; Late over End 3. She gains
  `(Guts / 2,000)^0.5 × 0.3 × coef` m/s (Front and Pace 1.0, Late 0.8; a front runner with no other within 10 m ×2).
- **Repositioning (位置取り調整).** Too far behind the leader (Front: not leading; Pace 2.5 m, Late 5 m, End 10 m, all
  scaled like the bands) she tries on a `20 × log10(Wit / 10)%` roll; with others within 3 m and 3 lanes she tries on
  the same curve read from Guts, scaled by `min(1, (nearby + same-style nearby) / 3)`. The notes say only that this
  check scales with Guts and the count of runners nearby, so that shape is ours. She gains
  `((Power / 1,500)^0.5 × 2 + (Guts / 3,000)^0.2) × 0.1 × coef` m/s (Front 0.8, the rest 1.0; a lone front runner
  ×1.1), and pays 0.5 more HP factor when only company, not distance, set her off.

### Lanes and passing

- **Swing by Power.** A blocked runner swings out up to `round(3 × (0.3 + 0.001 × Power) / 1.5)` lanes in a turn, from
  1 to 3: the original's lane-change speed, scaled so 1,200 Power reaches v6's three lanes.
- **Going round (ours, after the original's overtake lane mode).** A runner closing on a slower one within two lengths
  in her lane moves one lane out before she reaches her. Without it, the faster runner was the one boxed in: the
  skilled runner above was blocked for up to 15 s in the races she lost.

### Skills

- **Unique skills race at Lv5** (a fully starred Uma's): target speed ×1.10, acceleration ×1.08, other effects ×1.08;
  gate effects unchanged. Inherited uniques keep their own values. Applied when a race is prepared, for the player's
  own unique and every rival's.
- **A heal re-plans the last spurt** whenever it comes in the final leg, even mid-spurt, as in the original; v5 and v6
  only re-plan before the spurt point, so a gold heal during a short spurt was wasted.
- **`is_last_straight_onetime`** holds for the first 10 m of the final straight, less than a turn's run: in v7 it holds
  on the turn she enters the straight, so skills gated on it fire.
- **The finishing turn** charges HP only up to the line.

### Left out, and why

- **Rushing** and debuffs stay out (D141).
- **Power conservation and Fully Charged** (Power over 1,200): the notes cannot say when it builds or how long the
  acceleration lasts.
- **Full-throttle spurt** (Speed over 2,000): no cap passes 2,000.
- **Wit over 1,200** raising gold and unique skills: no formula has been published.
- **The lane-change speed bonus** `√(0.0002 × Power)` applies only while a lane-speed skill is active, and those
  skills are unsupported. The **force-in** bonus (a few hundredths of a m/s early on) is too small to matter.

## Realistic rivals (D159)

D152 built rivals on a **full tree of 5★ cards** (950 a stat in scenario 1). Nobody races that: the owner's TL10 Special
Week is 989 / 617 / 567 / 616 / 691. v7's rivals are built on a typical set: **six current-era cards at 3★, one of
them a Friend card whose share of the nodes pays skill points**, plus the stat nodes. That is 712 a stat in scenario 1
and 905 in scenario 14. The grade handicaps (D152) apply on top.

**Stamina follows the distance.** A trained Uma carries the Stamina her race needs, and no more. `fullSpurtStamina`
estimates it from the original's HP model: the opening and middle legs at her style's pace, with a margin for the
field's pushes (Front 6%, others 0%, plus 4 points a kilometre), then the final third at full spurt, which her Speed
makes dearer and her Guts cheaper. It matches engine v7 to within about 5%. A runner with exactly that Stamina holds a
full spurt in about half her races. It asks about 300 Stamina at 1,200 m, 700 at 2,000 m, 1,000 at 2,400 m and 1,400
at 3,000 m, which is close to the original's usual guidance for those distances. A rival's preset carries it from a
90% roll up, so about half the field holds a full spurt, and she never puts more than 40% of her build into Stamina.
The rest is spread by distance and style, as before.

## Measured on v7

`pnpm sim:turns`, 40 races a row, 2026-09-26:

| Check | v6 | v7 |
|---|---|---|
| 1,000 Speed with a Lv5 unique, two golds and two whites (all firing) finishes ahead of 1,400 Speed without, 2,000 m | 0% | 83–95%, by 0.27–0.36 s |
| Average place of a pace runner with +300 in one stat, 2,400 m, field of 800s (none: 7.0) | Speed alone moved her | Speed 3.1 · Power 5.2 · Wit 5.5 · Stamina 5.8 · Guts 6.1 |
| A runner at twice the field's stats, 2,000 m | wins 100% by 2 s | wins 100% by 1 s |

The remaining losses in the first row are races where the faster runner won the early position among the front
runners, or where the two drew moods three levels apart. `pnpm sim:constellation` holds every hard stamina-ladder
check, and `pnpm sim:careers` is in [Racing](../design/racing.md#difficulty-target).
