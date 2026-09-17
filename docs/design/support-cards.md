# Support Cards

> All numbers are **draft values for tuning**.

## SSR only ✅

The game only has **SSR** cards. Cards that were R or SR in the original game are not included.

## Card template (static)

| Field | Notes |
|---|---|
| `id`, `character`, `title` | Taken from the original game's data |
| `type` | Speed, Stamina, Power, Guts, Wit. Friend and Group cards come after the MVP |
| `jpReleaseDate` | Decides the **era** (see [Scenarios](scenarios.md#era-windows)) |
| `obtain` | `event` / `free` / `gacha` in the original game. `event` and `free` cards make up the **starter set** |
| `effectProfile` | *Which* effects the card has and their relative weights. Values are generated (below) |
| `hintSkills` | Skills the card can hint during training, seeded from the original data |
| `icon` | Local asset reference only |

## Ownership vs. equipping

These are two separate rules:

- **Owning** is account-wide. Cards come from the starter set or from Card Select Coupons (see [Collection](collection.md)).
- **Equipping** is per Uma and gated by era: an Uma in tier `T` can equip any **owned** card with `era ≤ T`.
  An owned card from a later era shows a lock such as "Arrives in Project L'Arc".
- **Card levels are shared across all Umas** (one copy per card).

## Deck

- **6 ordered slots**, following the original game's 5 cards plus 1 borrowed friend card.
- Slots unlock gradually in early tiers: tier 1 has 4 slots, tier 2 has 5, tier 3 and later have 6.
- A saved deck may use any nonzero number of its unlocked slots. Order is persisted and is the deterministic input order
  for Training deals.
- No duplicate card, and no two cards of the same character, on one Uma.
- The Uma Profile links to the deck editor. It shows owned candidates, later-era locks, Friend/Group unavailability, missing
  content repair states, generated effects, hint count, and summed Race Bonus. Reorder/remove and all slot actions use
  44-point touch targets.
- **Auto fill is explicit** and only changes the unsaved draft. It deterministically chooses a type-balanced set of owned,
  era-eligible stat cards, prioritizing the Uma's growth rates and never duplicating a character. Opening Training with an
  empty deck does not mutate the save; it links back to this editor. Friend/Group cards remain visible but inactive.

## Leveling and limit breaks

Cards level through **use** (see [Training — Card EXP](training.md#card-exp-from-training)).

| Limit break | Card levels | To advance |
|---|---|---|
| LB0 | 1–5 | Reach level 5 with full EXP, then promote |
| LB1 | 6–10 | Reach level 10 with full EXP, then promote |
| LB2 | 11–15 | Reach level 15 with full EXP, then promote |
| LB3 | 16–20 | Reach level 20 with full EXP, then promote |
| LB4 (MLB) | 21–25 | **Level 25 = maxed**, which earns a **Card Select Coupon** 🎟️ |

- At an LB level cap, EXP stops at the maximum until the card is promoted with **training tickets** (cost in [Economy](economy.md)).
- Promotion consumes the filled cap bar, advances into the next band (**5→6**, **10→11**, **15→16**, **20→21**),
  resets EXP to zero, and grants the normal +2 tickets for that new card level.
- Each promotion unlocks that LB's stats.
- **Every card level-up earns +2 training tickets**, and maxing a card earns a Card Select Coupon.

Draft card EXP curve:

```
cardExpToNext(level) = 40 + 15 × (level − 1)
```

## Effect values (generated, not copied)

```
effectValue = baseValue[effect]
            × eraMult(era)                1 + 0.08 × (era − 1)    → era 11 = 1.80×
            × lbMult[lb]                  LB0 1.00 · LB1 1.10 · LB2 1.20 · LB3 1.32 · LB4 1.50
            × (1 + 0.02 × levelWithinLB)  0–4 levels into the current LB
            × profileWeight[effect]       from the card's effectProfile
```

### Effect set (MVP)

| Effect | Draft base value (era 1, LB0) | Used by |
|---|---|---|
| Training Bonus | +5% | Training gains |
| Friendship Bonus | +15% | Friendship training multiplier |
| Stat Bonus (card type's stat) | +6 | Flat facility gain |
| Skill Point Bonus | +2 | Flat SP gain when present |
| Specialty Priority | +15 (added to the 35% base) | Deal chance at its own facility |
| Hint Frequency | +20% | Skill hint chance |
| Race Bonus | +3% | **Uma EXP from races** while equipped |
| Initial Stats | +10 to the card type's stat | Granted once when an Uma promotes with the card equipped |

### Unlocks by limit break

| LB | Unlock |
|---|---|
| LB1 | Race Bonus becomes active |
| LB2 | Specialty Priority +50% |
| LB3 | Initial Stats doubled, and a gold skill added to `hintSkills` |
| LB4 | **Unique effect**: a signature bonus, seeded from the card's original unique effect |

Race Bonus contributes only from LB1 onward. At LB4, the generated MVP signature maps only source tuple **effect identity**
to one of the eight effects above. Each distinct supported identity adds **25% of the card's normal generated level-25
value** for that effect. Original tuple values and conditions are never copied or evaluated; unsupported identities remain
inactive and are labeled as such. Initial Stats is displayed now but is applied only when scenario promotion is implemented.
