# T060 — The early stamina wall

> Owner: Claude. Found while calibrating careers (M017, D137–D138).

## The problem

Below about Training Level 6 **no build wins any race at 35%**, at any grade and any tier. `pnpm sim:careers` finds a
tier-1 Maiden G3, Trials G2 and Main-goal G1 all first reach 35% at TL6. A race probe shows why:

- The untrained floor is `50 × Training Level` (D134), tuned for the TL10 stamina ladder. At TL1–4 it leaves every
  stat the constellation has not reached at 50–200.
- Card nodes open fastest for the stats a set favours, so a TL3 sprinter has Speed ~1,000 and Stamina ~130–240.
  Last-spurt HP use grows with speed, so she runs dry well before 1,400 m.
- Against a weak field everyone runs dry, and the race turns into a lottery. **Weakening the field does not help**:
  bisection found no field strength, down to 20% of a G1 field, where a TL1–3 build wins half its races.

A career makes this visible: its Maiden G3 at Uma Levels 1–2 is in practice a TL6 race.

## Direction (to decide with measurements)

1. **Raise the floor at low Training Level, keep TL10.** For example `floor = 200 + 30 × TL`, which is 500 at TL10 as
   now, so the D134 ladder is untouched, and 230–320 at TL1–4.
2. **Or tie the floor to the build**, for example 40% of the Uma's highest stat, so stamina keeps pace with speed as
   nodes open.
3. Re-run `pnpm sim:constellation` (the ladder must hold) and `pnpm sim:careers` with a target of the Maiden G3 at
   35%+ by TL3–4 and the Trials G2s by TL5–6, with G1s still at TL10 calibration.

## Acceptance

- The ladder's hard checks hold at every tier.
- `pnpm sim:careers` shows the Maiden G3 winnable (35%+) by TL4 in every distance at tiers 1, 7 and 14.
- constellations.md, the decision log and the domain pins change together.
