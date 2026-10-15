# Skills & Lineage

> **Status: built (generation 2).** Skill data is seeded from the original game through the private pack
> ([data backlog](../research/data-backlog.md)). The SP caps and shares are tuning values, pinned in tests.

Skills and aptitudes both come from her **build**: one of her four distance presets, with its card nodes and lineage,
plus her own kit ([03](../game/03-uma-progression.md) §6, §8). Nothing here is rolled, and nothing is frozen into a
snapshot: the library and the aptitudes are derived each time they're read.

## Skill kinds

| Kind | Source | SP cost | Notes |
|---|---|---|---|
| **Unique** | The Uma's own template | Free, always equipped | Her signature skill |
| **Inherited unique** | A lineage slot whose unique is open | 200 (from the data) | A parent's or grandparent's unique, in its weaker inherited form |
| **Gold (rare)** | Card nodes · a lineage slot's opened gold positions · her own awakening pair | 250–350 | An upgraded white skill |
| **White (normal)** | Card nodes · filled lineage slots · her own kit | 90–180 | The common pool |

A filled lineage slot passes a template's **baseline whites** at once, its **natural golds** through the slot's opened
gold positions, and its **unique in inherited form** once the slot's unique is opened (D174, which brings back what D123
removed; D336 made the unique its own unlock). The inherited form is the original game's own record for it
(`inheritedSkillId`), with its own values: Seiun Sky's *Angling and Scheming* gives +0.2 acceleration for 2.4 s where
her own gives +0.4 for 4 s. The engine takes those values as they are; it no longer halves them a second time.

## Where skills come from

Three deterministic sources, all recomputed rather than stored:

1. **Card nodes.** Each node a card occupies unlocks the **next of its golds**, while it has any left, and the **next
   of its whites** (D182). A card's whites are its `hintSkills`, in the pack's order; its golds are the golds among its
   `eventSkills`, in event order, because in the original a card's gold comes from its event chain and every hint skill
   is white. A card on four nodes pays four whites and up to four golds (most cards have one), so stacking a card is a
   skill decision as well as a stat one.
2. **Lineage slots.** Each filled open parent or grandparent slot contributes that Uma template's baseline whites, her
   natural golds through the slot's opened gold positions (in awakening-gold order), and her unique in its inherited
   form once the slot's unique is open. Choosing lineage is choosing skills: Seiun Sky lends any front runner her
   late-race corner acceleration.
3. **Her own kit** (D186). What she brings herself, as an original career does: her three **innate** skills and every
   skill her own **story events** teach (mostly whites); and her four **awakening** skills in pairs, a white and a
   gold, the first pair from the game's scenario 1 and the second from scenario 2 on, so from tier 2 she has both.

Plus her **own unique**, which is permanent and free.

### Upper skills (D188)

A gold stands on its white, and a ◎ white on its ○, as in the original: Concentration on Focus, Right-Handed ◎ on
Right-Handed ○, and Right-Handed Demon on Right-Handed ◎. **Equipping a skill learns every skill below it in its chain**,
each is paid for once, and **only the highest learned skill of a chain races**; the gold is the improved version that
takes effect. So a gold costs its own SP plus its white's, unless the white is already equipped, and equipping the gold
takes the white's place. The white does not have to be in her library for its gold to be learned. A chain whose upgrade
no longer fits the SP she earns races its lower skill alone. 336 of 346 golds have a white in the data and all 65 ◎ have
their ○; the few that stand alone (Runaway and some scenario golds) cost only themselves. The Skills tab prices each
skill by what equipping it adds to the loadout, its whole chain included.

Everything lands in the preset's **skill library**, deduplicated. Removing a card removes the skills it was paying
for, in the same way it removes the stats.

## Skill Points are the only limit

SP is not spent and not earned per turn. It is a **capacity**, capped by the game's scenario *T*:

| *T* | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `spCap` | 2,000 | 2,400 | 2,800 | 3,000 | 3,200 | 3,400 | 3,600 | 3,800 | 4,000 | 4,200 | 4,400 | 4,600 | 4,800 | 5,000 | 5,200 |

Grounded where the original game is measured — Unity Cup careers finish around 2,000–2,500 SP and Trackblazer
around 2,800 (Game8) — and a draft elsewhere (D133); the 15th continues the +200 ladder
([04](../game/04-tiers-and-promotion.md) §1). A typical gold with its white prerequisite costs about 340 SP in our
content, so the first scenario buys five or six.

**The Observatory pays the baseline:** 40% of the cap in proportion to her open card nodes,
`round(0.40 × spCap(T) × open nodes ÷ N)`. **Friend and Group cards pay the rest**, about 60% of the cap on their fair
share of the nodes, and the total is clamped to `spCap(T)` ([03](../game/03-uma-progression.md) §8). In URA Finale, 12
open nodes give 800 SP, and a Friend card on two nodes adds 1,200, reaching the 2,000 cap.

The equipped **loadout** must cost ≤ current SP. Swapping is free and instant outside races. If a change takes SP away
after skills were equipped, racing does not stop: the equipped skills race in equip order while they fit, and the rest
sit out until the SP is back or they are unequipped (D132). An overdrawn loadout is never locked: any change that costs
no more than the loadout it replaces is accepted, so skills can always come off (D196); only a change that adds cost
must fit.

So the loadout trade is direct and legible: a bigger library needs more slots spent on cards, and equipping
more of it needs nodes spent on a Friend or Group card. That is the whole economy of skills.

## Loadout

Skills live on the profile's **Skills** tab, `/town/stable/outfit/:umaId/skills` (`/stable/:umaId/skills` redirects
there), for the selected preset: the preset switch, the SP line ("SP 160 / 267", red when over), **Equipped** (her
unique, always on, then the loadout in equip order, each with move up, move down and Unequip) and the **Library**
(Equip with what it adds in SP, or "Can't race yet" for a skill whose race mechanics aren't built).

- Any subset of the library whose total cost is ≤ SP. The unique is free and always on.
- **One loadout per distance preset.** A race uses the preset of its distance (D254), so her Sprint and Long presets
  carry different kits.
- The pre-race sheet lists the skills she carries into that race, with their SP.

### Skill tags

Tags are read off a skill's Global conditions and effects (`skillTags`, the same reading uma-planner uses), so they
need no authoring and track the data:

| Tag | From | Shown as |
|---|---|---|
| Running style | `running_style==1–4` | Front · Pace · Late · End, or **Any style** when neither style nor distance is set |
| Distance | `distance_type==1–4` | Sprint · Mile · Medium · Long |
| Surface | `ground_type==1–2` | Turf · Dirt |
| Phase | `phase`, its `_random` forms, and `phase>=` / `phase<=` ranges | Opening · Middle leg · Final leg · Last spurt |
| Place | corner, straight, final corner, final straight, hills, a bad start | Corner · Final straight · Uphill … |
| Effect | the effect ids the race engine reads | Speed · Acceleration · Recovery · Stats · Debuff … |

The domain derives them; generation 2's Skills tab lists names only, so the tags wait for a list that shows them.
Names are the official Global names wherever the skill has shipped there (`name_en`); the community translation of the
JP name is only a fallback, and descriptions use Global terms for the running styles.

The library follows her build. It carries through the advance with her unlocks, and at promotion her unlocks and
presets are cleared, so only her own kit stays ([03](../game/03-uma-progression.md) §5–§6,
[04](../game/04-tiers-and-promotion.md) §4). Her selected preset's library, read at each race, advance and promotion
and when the Trophy Hall opens, feeds the skill badges ([Badges](badges.md#7-training-skills-goals-and-lineage)).

---

## Lineage

Six slots — **2 parents, 4 grandparents** — each opened by a **Lineage Hall** session, with each slot's inherited
unique and its two natural-gold positions as unlocks of their own: 24 unlocks a tier, layered across its five scenarios
([05](../game/05-training-hub.md) §3, §5). Each parent slot is linked to exactly two grandparent slots and is detached
from the card tree.

A slot holds a **reference to an Uma template the account owns**; an owned Uma stays owned, so that is any Uma it has
ever owned, in any tier (D327). Not a snapshot, not a trained instance: templates never change, so nothing needs
freezing and nothing can go stale (D123). In The Twinkle Legends, the first parent slot may hold any Uma in the game
([04](../game/04-tiers-and-promotion.md) §8). Owning more Umas is still exactly what makes lineage good.

- Her own character, in any outfit, is never eligible.
- The two parents must be different characters. A grandparent cannot be either parent or repeat a character on its
  own side. The **same exact grandparent outfit** may occur once on each opposite side, in either position; a
  different outfit of that character is not an eligible mirror.
- Slots are editable whenever they are open: who fills them is free and instant outside a race, and each preset keeps
  its own picks ([03](../game/03-uma-progression.md) §6).

### What lineage pays

1. **Skills** — each filled open slot's whites, plus its inherited unique and natural golds where those are opened.
2. **Aptitudes** — the only thing in the game that moves an aptitude grade.

### Unlocks and grandparent pricing (D250, D336)

A grandparent slot needs its **parent's slot open** (it need not be filled). A slot's unique and each of its two gold
positions need **that slot open**, not filled: a position pays the gold of whoever fills the slot, now or later.
Positions are indexed in awakening-gold order, not keyed to a particular ancestor. Opened slots and positions stay open
through any change of who fills them. Unlocking makes a skill available; it does not equip it or waive SP. Own-kit and
card availability is unaffected by a closed lineage position.

An inherited unique or natural gold supplied only by a **single-side grandparent costs 2× SP**, including the gold's
entire prerequisite chain. The same grandparent outfit on both sides uses normal SP. Parent/own/card sources use
normal SP; a deduplicated skill uses its cheapest live source. Shared prerequisites are paid once at the cheapest
selected upgrade's rate; explicitly selecting a white cannot bypass a 2× gold. A baseline white selected without its
gold is normal price. Skills UI, budget validation and racing all use this same derived pricing. Mirrored
grandparents count as two filled aptitude slots but never duplicate a library or equipped skill.

`umas/{outfitId}` holds what is opened, `inspiration: { slots, uniques, golds }`, once for the whole tier and shared by
her four presets; each preset holds its own picks. Promotion clears both ([03](../game/03-uma-progression.md) §7).

### Aptitude upgrades

For each of the ten individual aptitudes (turf, dirt · sprint, mile, medium, long · front, pace, late, end):

```
steps(a)  = max(0, |{ filled slots whose template grades a at A or S }| − 1)
result(a) = max( gradeIndex('A'), baseGrade(a) − steps(a) )
```

| Base | All six slots at A/S | Result |
|---|---|---|
| **F** | 5 steps | **A** — a perfect lineage can rescue an F |
| **G** | 5 steps | **B** — a G can never reach A, ever |

Upgrades are capped at **A**; **S is never granted**. One filled slot gives zero steps, so lineage has to be
built deliberately, and grades recompute live as slots change.

## Race engine impact

Skills are a core system, so race engine milestone **R2.5 (Basic skills)** comes before pack mechanics.
See [Racing](racing.md#race-engine-milestones).
