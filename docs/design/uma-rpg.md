# Global Uma RPG — design and implementation boundaries

> **Status: first real URA chapter published; Home playable release authorized (D257).** The owner has fixed the mode's global scope,
> outfit-specific RPG levels,
> Speed-as-offense mapping, a permanently chosen running-style class, visible weapon/element identity, and
> inventory-only destination for its future rewards. Level 50 is a repeatable **class-promotion point**, not a final
> cap. Five filled party slots, the signature-element choice and the Inspiration token destination are fixed.
> T089 has pinned enrollment, level/stat projection and tree/loadout rules (D227); T091 has pinned combat and the
> compositional skill catalog (D229). T095 supplies branching maps (D245); T096 settles encounter EXP and integrates
> safe-checkpoint progression (D246). T097 implements the private pipeline and prepared URA draft (D248);
> T098 integrates scenario Inspiration rewards and independent slot/gold unlocks (D250); T105 adds the temporary
> Inspiration advance (D256). T099 adds runtime-verified Home entry, saved-party resumes and the
> shared nine-page guide. Complete private manifest `56f02305d0ee` contains the real URA chapter and portraits.
> **The owner requested production-first validation; physical-iPhone and real-account gameplay acceptance follow
> deployment, not a pre-merge gate.** See the [release checklist](../research/rpg-release-acceptance.md) and
> [private publication record](../research/rpg-private-ura-handoff.md). The other thirteen chapters remain M029.

The [research](../research/uma-rpg.md) compares phone RPG references and measures the overlapping Uma aptitudes.
This mode is a fourth, self-contained account activity reached from Home, beside Farm, Collection/Racing and Training.
It uses owned Uma **outfits** as a persistent RPG roster, five saved party presets, branching chapter maps and
turn-based battles. Its progression is deliberately independent of race Uma Level, per-scenario Training Level,
Farming Level and support-card stars.

## The player loop

```text
Home → RPG hub → choose a party preset → choose any chapter → preview route/level warning
     → choose a path node → fight with five owned outfits → result + RPG EXP
     → level-up reveal → adjust RPG skills at a safe checkpoint → choose next path
     → boss → chapter-clear reward enters global Items
```

- The hub opens directly on the player's saved RPG state; it does not ask for a featured Uma first. Its internal
  navigation is **Hub · Roster · Parties**, with per-party chapter/resume actions and a global Items link. No sixth bottom tab.
- Five named presets are account-wide quick configurations. A preset saves member order, active signature element and RPG
  skill loadout for each slot; enrollment saves an outfit's initial signature as the default when adding it to a
  preset. A preset may choose a different eligible signature without changing the outfit's locked class or weapon.
  An outfit's style and current weapon path live on its RPG profile, not independently
  chosen by each preset. A chapter requires **five filled slots**. An empty or partial preset is editable but cannot
  launch. The first-pass proposal disallows the exact same outfit twice in a party; two different outfits of one
  character remain a content/identity validation detail, not a reason to change the five-slot rule.
- Any preset may choose any chapter. Recommended RPG level and expected enemy elements are shown; a low-level party
  gets a warning, not a hard gate. Chapter progress belongs to the **preset-and-chapter checkpoint**, so switching
  presets or chapters does not erase another map position. Each preset has one foreground chapter; selecting a
  different chapter explicitly pauses the current one at its last cleared node, never silently overwrites it. If a
  battle was open, its in-battle actions are forfeited but its frozen encounter entry remains available for free retry.
  RPG levels earned by an outfit remain global across all presets.
- The map branches around enemy compositions and tactical tradeoffs, not random hidden doors. G1 race names, distance
  bands and surfaces may theme map nodes and suggest their enemy mix, but these are RPG encounters: they do not run the
  race engine, mark race goals, or pay racing EXP.
  A path reconverges before a named boss. The synthetic proof has two required fights and an optional elite;
  production counts remain private authoring. Encounter/replay EXP and scenario-token rewards are settled below.
- After a fight, the result shows each participating outfit's RPG EXP, new level, stat changes and newly available
  skill slots/tiers in a Fire Emblem-like reveal. The player can open skill setup before choosing the next map node.
  Accepted map advances collect Skill Tokens and boss clears collect Slot Tokens into global Items for that
  scenario. Their Inspiration use is defined below, not on the card Constellation.

## Outfit RPG profile and progression

An owned outfit has one class tier, level and EXP track shared by every preset and chapter. Different outfits of the same character
have different RPG levels, as in Farm; there is no scenario-specific RPG copy. An RPG profile shows its class, chosen
weapon, active element, available element affinities, skill slots, level/EXP and combat attributes. Only the RPG area
shows RPG Level. Racing and Farm values are read as inputs where specified, never mutated by RPG fights.

| Existing Uma input | RPG attribute it informs | Intent |
|---|---|---|
| **Speed** (base stat + growth) | **Physical ATK and magical MATK** | The owner's core mapping: Speed is the main race-winning stat, so it should drive both offensive routes. |
| **Stamina** | Initiative and HP | Stamina enables longer efforts in racing; it does not replace Speed as the primary damage stat. |
| **Power** | Physical DEF, guard strength | A sturdy physical role. |
| **Guts** | Dexterity / critical reliability | Precision and clutch effects, not another raw ATK stat. |
| **Wit** | MP and magical resource economy | A visible reason to value Wit on caster and support builds. |

The conversion freezes the outfit's **base racing stats and growths** and their source content version at RPG
enrollment (D226), not its mutable scenario constellation or Produce assignments. A later private pack update cannot
silently change an already-enrolled RPG profile; any explicit rebase would need a separate migration decision. This
keeps the global profile stable when the player switches scenarios. Level-up gains are deterministic,
never a hidden random stat roll. At RPG enrollment the player chooses one eligible running-style class and one weapon
path for that outfit. The **running style is permanent** across presets, chapters and promotions; a dual-A racing
outfit does **not** level multiple style classes or switch between them. The selected weapon path stays with that outfit
through chapters and promotions in the first delivery, so there is only one active weapon × element matrix. A later
within-style respec would be a separate design change, not parallel progress. Multiple aptitudes create breadth in
the *elemental* trees instead.

### Settled T089 rule: repeatable class tiers and stats

Each outfit starts at **Class Tier 1, Lv1**. Lv50 is
the end of one tier's learning arc; after resolving its pending EXP and skill choices, the player may **promote** to
Tier 2, Lv1, then Tier 3, and so on. There is no planned final tier. Promotion never changes the locked running style
or erases earned stats, and never changes race Uma Level or Farming Level. The selected weapon path also carries
forward; a future within-style respec is outside this first delivery. The initial pacing target is
**roughly ten RPG levels per scenario-length chapter**, so a five-scenario block roughly fills one 50-level tier;
fourteen current scenarios would give about two promotions and progress deep into Tier 3. This is a pacing target,
**not** a chapter-order gate: any party may enter any chapter, and replay/catch-up rewards must respect the outfit's
current tier and level. Future scenarios extend the loop without a schema cap.

| Measure | T089 rule (D227) | What the player sees |
|---|---|---|
| Tier-local level | `1…50`, per owned outfit, followed by an explicit promotion into the next tier | `Tier 2 · Lv1` is visibly stronger than `Tier 1 · Lv50`; the profile also shows lifetime promotions. |
| EXP to next level from current level `L` | `120 + 16L` for `1 ≤ L < 50`, integer EXP; **25,480** from Lv1→50 | 136 from Lv1→2, 280 from Lv10→11, 904 from Lv49→50. At Lv50 EXP banks without auto-promotion; explicit promotion applies it to the new tier, possibly crossing several levels. |
| Permanent core RPG stat `s` | `round(B_s / 5 + N × 1.5 × (1 + G_s))`, with `N = 50 × (tier − 1) + (L − 1)`; `B_s` is base racing stat, `G_s` stored fractional growth (`0.2` means +20%) | Five deterministic values derived from lifetime promoted levels, not mutable random rolls. Promotion advances `N` from 49 to 50 and cannot lower a stat. |
| Combat projection | `ATK = MATK = Speed`; `initiative = Stamina`; `PDEF = Power`; `MDEF = round((Power + Wit)/2)`; `dexterity = Guts`; `HP = 100 + 6×Stamina + 2×Power`; `MP = 20 + 3×Wit` | Weapon channel decides which offensive value is used. Round core stats once after base/growth conversion. |

The former quadratic candidate (`100 + 18L + 2L²`) required 2,760 / 8,760 / 18,760 / 32,760 / 44,760 EXP for
successive chapter-sized stretches: a **16.2×** first-to-last jump. T089's linear curve needs **2,080 / 3,680 /
5,280 / 6,880 / 7,560** for Lv1→11→21→31→41→50, a **3.6×** jump. T096 measures actual encounter payouts against
both synthetic routes rather than pretending all chapters award one equal lump of EXP.

For a **synthetic** outfit with base Speed 100 and growth `0.2`, RPG Speed reads 20 at Tier 1 Lv1, 22 at Lv2,
108 at Tier 1 Lv50 and **110 at Tier 2 Lv1**. That example is invented, not copied from private Uma data. A promotion
result shows exact five-stat carry-forward; no retroactive stat reroll or hidden tier bonus. If the lifetime gain
makes later tiers too strong, tune enemies rather than resetting earned stats. HP, MP and magical defense are pinned
here; T091's first damage rules are below, while class-mastery variant effects remain later work.

EXP is awarded once for a **won encounter** to all five frozen entrant outfits, including a member KO'd before the
win; a lost or abandoned encounter pays none. The boss pays its authored encounter EXP, while chapter clear grants
its scenario token, **not another hidden EXP bonus** (D225). Level-relative rewards accelerate catch-up and
taper farming weak chapters, but never to zero for an authored positive payout. EXP earned at Lv50 **banks** until the player promotes; promotion then applies that bank to
the next tier without loss or duplicate grants. The result names every crossed level, exact stat changes and new
skill choices. `pnpm sim:rpg:progression` runs the synthetic two-tier, replay, catch-up and focus/breadth checks; it
does not read private chapter or Uma content.

### Settled T096 encounter EXP and checkpoint choices (D246)

Each battle node carries explicit integer **`baseExp` (0…1,000,000)**. It is frozen with the chapter's recommended
tier/local level when entering, not recalculated by the result screen. Let
`d = 50 × (entrantTier − recommendedTier) + entrantLevel − recommendedLevel`, using that outfit's **frozen entry** level. A win pays
`max(1, round(baseExp × clamp(1 − 0.025d, 0.25, 1.5)))` per entrant. A zero base pays zero, as do loss/abandon.
HP, KO and the number of survivors never reduce a winner's payout. Concurrent wins may change the recipient's
current profile, but never the frozen level-relative factor. EXP settlement consumes the existing `120 + 16L`
curve repeatedly, stops at Lv50 and banks all overflow. There is no hidden boss-clear EXP.

The starter **authoring helper**, not a runtime fallback, sums the cost of ten levels from the recommendation
(stopping at Lv50), multiplies by **1.10**, then by **0.40 ordinary / 0.25 elite / 0.60 boss**, rounding each base
once. A Lv50 recommendation uses the final Lv41→50 stretch. These weights apply to the two/three-fight synthetic
graph; a differently sized private chapter must budget its explicit nodes and remeasure before release.
For its Lv10 recommendation the invented opening/elite/boss bases are **1,549 / 968 / 2,323**. Old nodes without
`baseExp` and old frozen v1 kits remain unrewarded, not retroactively paid. T097 must author positive EXP for every
production fight; no synthetic reward or opponent substitutes for a missing pack.

`sim:rpg:progression` prints each fight and chapter for recommendations Lv1/11/21/31/41 over two tiers:

| Route | Tier 1 chapter end levels | First promotion | Tier 2 chapter end levels | Second promotion |
|---|---|---|---|---|
| Two fights / rest | 11 / 21 / 31 / 41 / 50 | 657 bank → Tier 2 Lv5 | 12 / 22 / 31 / 41 / 50 | 909 bank → Tier 3 Lv6 |
| Three fights / elite | 12 / 23 / 34 / 44 / 50 | 4,219 bank → Tier 2 Lv17 | 21 / 28 / 36 / 46 / 50 | 5,165 bank → Tier 3 Lv19 |

The gate is **7–14 levels** for non-final first-tier chapters, **3–14** after carried-bank promotion; final chapters
must reach Lv50, and both promotions must preserve bank and nondecreasing stats. Measured non-final gains are
10–11 first-tier and 4–10 second-tier. Elite earns extra progress and can reach Lv50 before its boss, whose EXP
then banks; it does not create a second token. For base 1,619 at Tier 1 Lv11, Tier 2 Lv11 replay pays **405** at the
25% floor, while Tier 1 Lv1 catch-up pays **2,024**. The 150% ceiling bounds larger gaps. These are small synthetic
progression checks, not a production combat-balance claim.

The replayed terminal command atomically writes result evidence, checkpoint and all five positive EXP projections.
Pending previews name every crossed level, all five stat deltas, tree points, active slots and bank, but say
**unearned** and expose no spend action. Only acknowledged profiles fund choices. A profile-only stale revision
can adopt authoritative profiles and resubmit the **same result id, seed, kit, state hash and deltas** at their new
versions; a changed checkpoint/lease cannot be reconciled into a win. Lost acknowledgements use the durable receipt,
not another grant. No race, Training, Farm, card or global Item resource moves in this task.

After accepting the winning map node, each party member links to her RPG profile/skill editor. One grouped
`edit-outfit` spends exactly one earned point; loadouts are validated against learned skills, affinity, weapon and
slot bounds. Edits depend on the outfit, all five preset membership versions and involved foreground checkpoints;
an open battle or pending result blocks spending/promotion. They only affect later entries. Manual promotion at
Lv50 archives the whole current tree, explicitly discards unspent points if any, selects zero to two usable legacy
techniques and settles the full EXP bank into the new tier. Unselected equipped skills are pruned from **all**
presets in that same group. Style/weapon/enrollment inputs never change. New-tier points/slots follow the existing
ladder, and the current tree starts empty; class-mastery variant effects remain a separate candidate, not shipped.
[Phone proof](../research/rpg-progression-phone-proof.md) records the pending/result/setup/promotion checks.

### Settled T089 scaffold: skill trees and tier renewal

Attack and Guard are always available and **do not consume equip slots**. One locked class/weapon supplies its neutral
basic action and utility. Its **weapon × element matrix cell is a five-depth mini tree**, not one linear spell. An
outfit's A/B **distance** aptitudes determine which elemental cells it may invest in, always for its currently selected
weapon path. A multi-affinity outfit distributes one tier's learning across *those elements of its single class*; it
never receives a second running-style tree or a second class EXP track.

The accepted starting scaffold awards one tree point at each **even tier-local level** (Lv2, 4, …, 50): 25 choices per
tier, with the first onboarding choice at Lv2 and subsequent choices two levels apart. A point can deepen an eligible
cell, take an alternative branch at an already opened depth, or improve a learned technique by
one skill level, up to **skill level 5**. Depths unlock gradually: early levels offer a focused strike/support base;
middle levels open target-pattern and setup choices; the fifth-depth signature is first eligible at **Lv50**. Choices
are not automatic stat rolls: the result identifies available points and offers a safe-checkpoint skill-tree CTA.
Each unlock or +1 skill level costs **one point**, including an alternative branch. Depth gates are tier-local levels
**2 / 10 / 20 / 34 / 50**. Each depth after one requires at least one purchased node at the previous depth in the
same elemental cell. Branches are foundation; focused/area; committed/multi; role/hybrid; signature. A-grade cells
may reach depth 5; B-grade cells stop at **depth 3**. If two distance aptitudes offer the same element, A wins.
Skill level caps at **5**. A node's purchased level counts as its point cost. The 25-point synthetic sim shows
focused Fire buying five Lv5 nodes through depth 5 versus breadth buying five elements' foundations at Lv3 and
area branches at Lv2, with no capstone.

| Depth | Decision within each permitted weapon × element cell | Example payoff |
|---|---|---|
| 1 — foundation | Learn that weapon's elemental attack or support motif | Physical Fire cut, magical Ice bolt, or Light ward. |
| 2 — target shape | Focused single target **or** weaker area pattern; the other branch can be bought later | Boss pressure versus waves; support chooses focused rescue versus party-wide smaller aid. |
| 3 — hit rhythm | One committed hit **or** multiple smaller hits/turns | Burst versus mark/status buildup; healer chooses immediate restoration versus staged recovery. |
| 4 — role expression | Class-specific combo, pure-support strengthening, or support-DPS hybrid | Paladin protect/retaliate; Cleric stronger ward versus ward plus magical counter. |
| 5 — tier signature | High-impact final technique at Lv50, for an A-grade affinity only | A visible capstone that becomes a legacy tool after promotion. |

These are *choice axes*, not a promise that every cell has only five total nodes. The alternative at a depth is a
real unlock, not a free toggle; investing in both trades away depth or another element. Improving a known skill to
level 5 raises its documented effect/efficiency within the current tier, but cannot bypass an affinity gate. Grade B
opens only depths 1–3 of that **same weapon**, never its fifth-depth signature or an alternate weapon tree. A
multi-A outfit can specialize two elemental cells or spread points widely, but cannot automatically master every
cell in a single tier.

**Active skill slots** are 3 at tier-local Lv1, 4 at Lv10, 5 at Lv20, 6 at Lv35 and 7 at Lv50. Attack and Guard
remain free outside those slots. A loadout may contain at most **two legacy techniques** among its active slots.
The preset may use any eligible active signature, not just the outfit's enrollment default. A skill id includes its
tier, locked weapon, element, depth and branch; duplicated ids and unlearned skills are invalid.

Promotion opens a **fresh Tier 2 matrix** for the selected weapon path and eligible elements: no unspent Tier 1 point
silently turns into a Tier 2 point. If points remain, promotion requires an explicit discard choice rather than
silently deleting them; Tier 2's tree choices begin empty. The full prior tree is archived as mastery
history, while the player selects up to two learned current or carried skills to keep usable as **legacy techniques**.
That bounded pair survives until deliberately replaced at a later promotion; archived but unselected skills do not
auto-unlock Tier 2 equivalents. Attack and Guard remain usable even when no legacy skill is carried. New-tier
techniques may adapt the cell's effect and offer a different branch choice, while the old tier's mastery stays recorded
for history and presentation.
At promotion, a small **class-mastery variant** is a candidate choice for the *new tier's* weapon skills—for example,
Greatsword pressure versus a wider cleave, or Paladin stronger protection versus a modest heal. It changes a tactical
rider, not the locked style, damage channel or base-stat growth; variants do not stack without bound across promotions.
The exact menu and effect sizes need combat simulation before pinning.
The mastery archive is separate from the active outfit projection; it does not grow the hot profile row without
bound. A battle freezes its entrant's tier, stats and loadout.
Several levels crossed in one result are named in order, and new skills never silently replace equipped ones.

## Class, weapon and aptitude identity

At first RPG enrollment, each outfit chooses **one running-style class from its A aptitudes** and **one weapon path**
inside that class. The **style is locked for that outfit**, including at promotion: multiple A running styles are
alternatives at enrollment, not parallel classes, extra trees or permission to switch later. Pace chooses Spear *or*
Sword + shield; Late chooses Wizard *or* Cleric staff. That one weapon path remains selected across chapters and
tiers. A future **within-style weapon change at promotion** would need a separate decision for mastery and legacy
techniques; it is not part of this first RPG delivery. The five party presets only arrange outfits and their elemental
loadouts, not independent copies of classes. No role is mandatory in a party.

| Running-style class | RPG role | Weapon choices | Damage and support identity |
|---|---|---|---|
| **Front — Breaker** | Physical-only heavy attacker | **Greatsword** | Heavy single-target and cleave hits, armor pressure, elemental martial finishers. No magical-damage actions. |
| **Pace — Lancer or Paladin** | Physical offense **or** physical support | **Spear** or **Sword + shield** | Spear favors repeated hits and marks; sword/shield guards allies, buffs defenses and heals while retaining physical attacks. |
| **Late — Wizard or Cleric** | Magical offense **or** magical support | **Wizard staff** or **Cleric staff** | Wizard has elemental burst/area control; Cleric has offensive buffs and healing with a modest magical attack. |
| **End — Tome Mage** | Magical-only specialist | **Magic tome** | Spell chaining, marks and elemental finishers. No physical-damage actions. |

At enrollment, the outfit chooses **one default signature element from its permitted affinities**. Each preset slot
may select its active signature from those same eligible elements. It determines the portrait overlay and
specialization for that party, but never prevents equipping other eligible elements. The owner's **10% specialization
bonus** applies once to the final nonnegative **damage or healing magnitude** of a technique of the locked weapon
and active signature element, after the combat engine's matchup calculation, rounded to nearest integer. A physical
base and elemental rider form one final magnitude before this bonus; the rider is not bonused a second time. MP
cost, status duration, neutral Attack and Guard do not receive it. T091 pinned the elemental advantage multiplier
and damage/healing calculations below. Two A styles do not grant two
simultaneous class bonuses or another class track. There is no End-only fallback, penalty or special party rule;
End follows the same aptitude, level, element, slot and reward contracts as Front, Pace and Late. Weapon identity comes
from the selected running-style class; element access comes from **distance aptitude** separately.

### Distance and element proposal

| A distance | Elements offered as signature/skill affinity |
|---|---|
| Sprint | **Dark, Light** |
| Mile | **Ice, Light** |
| Medium | **Fire, Dark** |
| Long | **Lightning, Light** |

Every A distance contributes both listed affinities, so a multi-A outfit can have more than two elements. Grade **A**
permits that element's highest tier; **B** contributes those elements only to lower depths of the currently selected
weapon's tree, never an alternate class/weapon or the A-only capstone.
The signature element selects the **portrait overlay and specialization bonus**, not a one-element spell limit:
the outfit may equip skills from every eligible affinity, subject only to the RPG skill slots/tier rules. T089 pins
the B depth and active-slot ladder; T091 pins individual skill effects below. **Turf/Dirt aptitude does not gate the RPG
element trees** in
this draft: surfaces can theme a chapter and appear in its route preview, while distance A/B controls elemental skill
eligibility. A future terrain bonus would require its own explicit decision and balance check.
An owned outfit with **no A running style is ineligible for RPG party selection**; it remains owned and usable in
other modes, but does not see an empty class picker or an invented fallback class. Class/element candidates come from
the outfit's source aptitudes, not editable racing defaults.

The elemental relationship is:

```text
Fire > Ice > Lightning > Fire
Light ↔ Dark (each weak to the other)
Light/Dark ↔ Fire/Ice/Lightning (neutral both ways)
```

The triangle direction and T091 multipliers are now fixed (D229). The combat UI always
shows a text/glyph legend, target weakness/resistance and projected effect. Color is an extra cue, never the sole cue.
Medium's Fire/Dark pair deliberately gives a large Medium roster two different matchup families; it does not yet grant
a higher damage coefficient or an extra skill tier.

### Weapon × element skill matrix

**Damage channel and element are separate axes.** Front and Pace basic attacks are neutral **physical** hits; Late
and End basic attacks are neutral **magical** hits. An MP-costing Greatsword Flame Rend is still a physical strike: its
elemental portion changes matchup/status, but the whole action uses ATK and physical defense. It is not secretly a
MATK spell. Likewise a Tome Fire Sigil uses MATK and magical defense. Paladin and Cleric healing/support spend MP but
do not turn their basic damage channel into the opposite type. This is how every weapon gains elemental play without
erasing the owner's physical-only Front and magical-only End identities.

Every permitted weapon/element pair receives the **five-depth branching tree** described above. The matrix below
names each cell's eventual combo identity; it is *design vocabulary*, not 30 copied source-game skills or a promise
to author 30 unique animations. The example names are invented and provisional. Six weapon templates, five element
motifs and a bounded library of target/rhythm/support branches should compose the variants without making each cell
an unrelated rules engine. Coefficients are domain rules to simulate, document and pin; checked-in tests use synthetic
actors.

| Weapon path / neutral baseline | Fire — Burn / pressure | Ice — Slow / control | Lightning — Chain / tempo | Light — Ward / cleanse | Dark — Drain / weaken |
|---|---|---|---|---|---|
| **Front Greatsword** · heavy physical cut | Flame Rend: physical cleave with burn addendum | Frost Rend: physical cut that delays target intent | Storm Rend: physical hit with secondary chain target | Dawn Rend: physical hit that breaks a hostile ward | Night Rend: physical hit that weakens the next enemy attack |
| **Pace Spear** · repeated physical thrust | Ember Lance: successive strikes intensify burn | Rime Pin: strike and slow a marked target | Arc Lance: repeat hit jumps to marked foe | Beacon Lance: expose target for an ally | Shade Lance: strike and reduce target offense |
| **Pace Sword + shield** · physical strike/guard | Ember Aegis: guard, then retaliate physically | Ice Bastion: guard plus stronger defense buff | Thunder March: guard plus ally initiative buff | Mercy Ward: defend and heal an ally | Gloam Ward: defend and blunt enemy offense |
| **Late Wizard staff** · magical bolt | Fire Bloom: magical burst/area burn | Winter Field: magical area slow | Chain Spark: magical jumps across targets | Sunray: magical hit against wards | Umbral Hex: magical hit plus resistance debuff |
| **Late Cleric staff** · small magical bolt/heal | Warmth: ally healing over time plus attack buff | Shelter: heal plus damage mitigation | Quickening: heal plus initiative buff | Benediction: focused heal and cleanse | Veil: restorative drain plus enemy weaken |
| **End Magic tome** · magical sigil | Cinder Script: stack, then detonate burn | Glacier Script: accumulate control for a seal | Volt Script: charge then chain damage | Halo Script: puncture a dark ward | Eclipse Script: mark then drain/finish |

These are **six possible weapon paths**, each with five elemental cells. The element's global motif remains consistent,
while the weapon changes target pattern and role. A skill card shows weapon, element, channel, tree depth, skill level, MP, target,
projected damage/heal, status/duration and affinity gate. For a multi-element outfit, any eligible skills can fill
its slots together; the signature element only chooses the specialization bonus and portrait badge. A single action
may use one element, never two advantages at once; a combo skill can require a visible setup mark or ally action but
must be deterministic and previewed. The first simulator should compare all six paths across neutral, advantaged,
disadvantaged and Light/Dark matchups, including whether healing/support crowds out offense.

A physical elemental technique should display a **physical base + an elemental rider**. Both portions use ATK against
physical defense; only the rider receives elemental advantage/resistance and its status effect. A magical elemental
technique uses MATK against magical defense and applies its element to the spell. This gives a Front an MP-spending
physical-plus-Fire attack without a hidden second MATK hit. Healing and buffs use their own support formulas; their
element changes the rider (for example Light cleansing or Lightning initiative), not the caster's damage channel.
For example, a Greatsword Fire tree can start with one burning cut, branch into a focused strike or weaker cleave,
offer a one-hit burn detonation versus several setup hits, and end at Lv50 with an A-only finisher. An Ice Wizard
tree can choose a single slow bolt versus area control. Tree depth introduces tactical choices; skill levels within
that depth improve a chosen technique up to 5 without changing its target pattern by accident.

## Five-member combat

A five-member party is **confirmed**; every slot must be filled to enter a chapter, but there is **no class quota**.
A natural team can be **one Front Greatsword, three Pace/Late flex slots and one End Tome Mage**, but neither Front nor
End is mandatory; a five-Pace challenge party is legal. The owner will acquire more End outfits normally—there is no
End-specific exception or filler system.
The phone prototype must make all five portraits and action states readable at 390 × 844; it is no longer a vote on
party size.

The core turn reads: inspect visible enemy composition/intent → choose an acting Uma → Attack, Skill, Guard or Item
(only if a later item policy defines battle consumables) → resolve with visible weakness and defenses → enemy action →
repeat. The player can target deliberately. Physical and magical damage, MP costs, healing, buffs, debuffs and KO
states are required categories; skill definitions and numeric effects are separate balancing work. Each skill must
state target, element, physical/magical type, MP cost, magnitude, duration, stacking and what happens on resistance.

The first combat slice proves: Front Greatsword is strong but strictly physical; Pace Spear and Paladin have
different physical plans; Late Wizard and Cleric have distinct magical offense/support; End Tome is strictly magical;
and every element's weakness matters. Weakness gives one **automatic bounded follow-up per player round**, never
another selectable turn or recursive chain. Enemy intent is revealed before commitment; no hidden reroll after reload.

### Settled T091 combat contract (D229)

`packages/domain/src/rpg/combat/` is a pure version-1 reducer. A frozen entry contains five distinct allies with
stats, locked weapon, affinity/tree/loadout and active signature; one to five enemy kits, including any phase-two
actions; content version; seed; and the fixed weakness-follow-up mode. `createEncounter` copies/validates the entry,
reveals the first intents and returns a versioned state hash. `applyAction` returns a new state, ordered render cues,
hash or a legality error with the **same previous state**. `replay` is equivalent to live stepping for every prefix;
the renderer never chooses damage, targets, RNG or phase. A JSON round trip preserves hash and intents. The seed
selects enemy move/seeded target from named round/enemy/phase streams, so changing one enemy's kit cannot reroll
another's intent. No wall clock or `Math.random` is consulted.

- One **round** gives each living ally one chosen Attack, Skill or Guard opportunity, in any player-selected order.
  `Item` is disabled. An ally cannot act twice; a KO'd ally cannot act. Enemies act after the last living ally has
  acted, once each in descending Initiative; enemy id breaks equal-Initiative ties. A KO'd enemy skips its intent.
  Ally Initiative is displayed from Stamina but does not add actions or override deliberate player order in v1.
  At most **40 rounds** are allowed; an unresolved battle at the limit is a loss. Victory is all enemies KO'd, loss
  is all allies KO'd; a simultaneous full-party and final-enemy KO is a **loss**. A KO'd entrant still receives
  future win EXP under D225, outside this engine.
- Enemy intent includes the selected move **and target** before the player commits. The move is chosen by seeded
  hash of entry seed, round, enemy id and phase; target is front formation, lowest HP fraction (id tie-break), or
  seeded live ally according to the authored policy. If the revealed target falls before its enemy acts, a deterministic
  retarget cue precedes that action. A boss crosses into phase two at or below its authored integer HP threshold
  (the synthetic fixture uses **50%**), and the new phase's intent is revealed immediately before any enemy
  resolution. A phase never silently changes after reload.
- Basic Attack is neutral and free: **physical** for Greatsword/Spear/Sword+shield, **magical** for Wizard/Cleric/Tome.
  Guard chooses one living ally. A single-target enemy hit aimed at that ally is intercepted by the first live
  protector in party order; the protector takes **50%** damage, rounded, minimum one. Guard ends after that enemy
  phase, including if no attack arrives. Enemy guards instead protect through the next player phase. Area hits
  are not intercepted. MP is validated then deducted once at skill commit, even when the target is KO'd by the
  first hit of a multi-hit skill; invalid actor, target, unlearned/wrong-weapon/grade/slot skill or insufficient MP
  leaves the state unchanged.
- For damage, compute the acting channel's ATK or MATK and the target's PDEF or MDEF. Deduct **0.45× defense**
  proportionally across a physical base and rider, clamping each nonnegative. Only the rider gets the elemental
  matchup; a magical spell's entire magnitude gets it. Fire > Ice > Lightning > Fire is **×1.5** for advantage,
  **×0.75** for resistance; Light/Dark are ×1.5 against each other and neutral to the triangle. A resisted attack
  does damage but suppresses its harmful status. Skill-level, existing outgoing/incoming statuses and the already
  pinned **×1.1 signature** apply with one final integer rounding; a neutral/weak hit then applies its new status.
  A weak hit can add one automatic **25%** post-damage follow-up in the player round, only if its target survives;
  it costs no MP, cannot apply another status, and cannot trigger itself. Basic Attack has no element/follow-up.
- Healing uses the same weapon's offensive stat—ATK for Paladin, MATK for Cleric—at the catalog coefficient,
  skill level and signature once, rounded and capped at missing HP. Light healing clears burn and weaken and grants
  Ward. Fire healing grants Regen. Other support healing grants Power Up. Light damage breaks a hostile Ward.
  Burn ticks for **2% of max HP per stack** after the enemy phase; Regen restores **4%** then; both and all other
  statuses begin at **two enemy phases** and tick down after effects. Burn/Mark stack to **three** and refresh duration;
  other statuses refresh at one stack. Mark raises incoming damage **10% per stack**; Power Up raises outgoing
  damage **15%**; Weaken and Slow each reduce outgoing damage **15%**; Ward reduces incoming damage **15%**.
  Statuses cannot revive KO'd actors. Skill effects and status ticks are ordered cues, never animation-driven rules.

The machine-readable catalog composes **six weapons × five elements × eight branches = 240 templates**, plus
**12 always-available neutral Attack/Guard definitions** (one pair per weapon). Skill ids
add the learned tier; each template declares channel, one element, target mask, MP, base/rider/heal coefficient,
status, duration, stacking, intent text and tree/A-or-B gate. B stops at depth 3; depths 4–5 require A. Foundation
offers the motif; depth-2 focused/area changes single versus group target (Paladin/Cleric use focused/party healing);
depth-3 committed/multi changes hit count (two hits at **0.58× each**); depth-4 role/hybrid changes support versus
damage-plus-small-heal; depth-5 is the A-only signature. A skill level adds **8% magnitude per level after Lv1**,
not another target. Basic Attack is **1.5× offense**. Weapon coefficients are Greatsword **1.20**, Spear **1.05**,
Sword+shield **0.82**, Wizard **1.12**, Cleric **0.78**, Tome **1.15**; each depth adds **16%** to its coefficient,
area is **0.62×**, and a physical technique splits **72% base / 28% rider**. Role healing starts at **1.25×** and
adds **0.20×** per depth; hybrid healing is **0.45×**. Skill MP is **4 + 3×depth**, plus **3** for area. These are
T091's first combat envelope, not a promise that every private enemy roster is balanced; T095/T096 tune chapter
composition and encounter EXP without secretly changing this rule.

`pnpm sim:rpg:combat` runs 12 fixed seeds for every weapon/element against neutral, weak and (for the triangle)
resistant synthetic teams, plus a two-phase boss, guard/heal pressure and a deliberately fragile losing party. At
this pin, the regular matrix clears **100%** in **4.7** mean rounds with **72% HP / 61% MP** remaining and **0.22**
allied KOs per battle; this is a starter-vs-standard fixture, not a target production win rate. Weak-target rounds
average **3.8 without** versus **3.7 with** the bounded follow-up, with 79–80% HP left: the follow-up is noticeable
without producing a second full turn. All 72 boss samples change phase, mean **4.7** rounds; the fragile elite
probe loses all 12. The sim gates broad turns/HP/phase/status/loss envelopes, while fixed replay hashes pin exact
mechanics. A stronger replay probe clears in **4.0** rounds, while the same boss against a weaker catch-up party
takes **7.0** rounds with more KOs; these are combat-only probes, not EXP payout rules. Real opponent kits and
chapter pacing now have T097's published private URA chapter and bounded replay check; real-party/device
balance remains post-release owner validation (D257, [record](../research/rpg-private-ura-handoff.md)).

Combat rules are pure TypeScript in `packages/domain`; presentation can use React for menus and PixiJS only if a scene
actually benefits from many animated actors. Rules consume a frozen encounter/content version, deterministic seed and
player actions. The screen animates the engine's result, never decides it. A **synced chapter checkpoint** stores the
last cleared node, frozen chapter version, party/kit snapshot, and any entered battle's stable identity and seed. The
active battle's action journal is device-local, so reopening on the **same device** restores the exact turn and
targets. A second device or reinstall must show that a battle was in progress and offer an explicit **restart from
its frozen entry state**; it may not silently reroll enemies, content, seed, or rewards. A versioned takeover makes
the former device stale before it can commit. Results grant EXP/items once by encounter/clear identity; navigation,
retry and reconnect cannot claim twice. Battle actions may not require a network round-trip.

**Reward acknowledgement:** ordinary save sync appends logs even when a related entity conflicts, so RPG results use
one conditional grouped save mutation (D223). Battle actions and same-device resume work offline. An offline entry
or finished fight is visibly **pending** until sync acknowledges it; its EXP, next map node and Item reward cannot be
spent while pending. A rejected competing-device result shows the accepted checkpoint and never applies its
provisional reward. This is an explicit first-delivery limitation, not a hidden reroll or a claim that two
disconnected devices can both commit the same encounter. The [implementation contract](../technical/uma-rpg-implementation.md)
defines the command and replay boundary.

The save/transport layer is present (D228), and Home entry requires the verified real chapter. Each
enrolled outfit, five-slot preset and preset/chapter checkpoint is a separate schema-v1 row; result, promotion and
command receipts are append-only. One authenticated grouped command supplies a stable id, expected versions for every
touched row, its proposed entity changes and evidence. The server accepts the whole group or none; an identical retry
returns the original receipt, while an id reused with different bytes is rejected. The normal sync endpoint refuses
RPG rows and logs. Dexie v18 holds acknowledged projections and a separate device-local pending queue: conflict or
offline state leaves a command pending and grants nothing spendable. An older cloud snapshot cannot erase local RPG
rows merely because it predates the feature. The current wire limits are five presets × five slots, 25 tree nodes,
64 selected path entries, 16,384 characters of frozen enemy-kit JSON and 20 grouped operations. The encounter seed
is FNV-1a over account, preset, chapter, attempt and node; loss retry changes only retry ordinal/result id, and
takeover changes only lease/revision. These are transport bounds, not chapter balance values.

T092's battle host now makes that boundary operational without exposing the mode yet. Dexie v19 holds an engine-v1
action journal keyed by entry id and retry ordinal, a local lease marker and displaced-journal history. A versioned,
key/enum-dictionary frozen combat kit contains the complete input within the existing 16,384-character wire bound; the
screen will animate its deterministic reducer rather than author actions or outcomes. Every accepted action appends
under an expected count, and reload replays the entire prefix and checks its engine hash before enabling controls.
A missing or corrupt local journal requires an explicit restart of the *same* entry; a different device must first
take over its lease. The host holds an offline entry/result as Pending, never projects EXP or map progress, and submits
terminal evidence only after replay agrees. The wire's 64-character result digest is SHA-256 of the engine's tagged
state hash. An accepted loss increments the retry ordinal but preserves seed, kit and party; abandon follows the
same zero-reward retry path. Rejected commands and displaced local journals remain recoverable history, not
automatically rebased attempts. T096 now adds EXP to this same grouped result, with only profile-version
reconciliation as defined above. T098 adds frozen token movements to winning map advances and chapter-clear groups.

T093 added the lazy `/rpg` setup route (D232). It projects five named presets even when none has
been saved, but creates a synchronized preset row only after an edit is acknowledged. Owned outfits come from the
existing Uma save and verified private content; enrollment freezes the source template's base stats, growths,
aptitudes and manifest version after explicit class/weapon confirmation. An A running style is required; no mutable
racing preference is consulted. Preset edits validate distinct enrolled outfits, eligible active signatures and
learned/slot-bounded loadouts before submitting a grouped command with expected preset and outfit versions. An
offline edit remains visibly pending and cannot masquerade as the saved preset; a stale revision requires an explicit
RPG-only account refresh, which leaves unrelated queued saves untouched.
Partial parties stay editable but cannot launch. T095 adds internal chapter selection/maps and T096 adds
acknowledged progression; T097 adds the private URA chapter and exact-version content pipeline.
T099 publishes the real chapter and exposes verified Home entry (D257); T098 implements the token sink.
The Home card inspects only manifest metadata on startup. On tap it lazy-loads the campaign
verifier, validates the active production-v2 pack, requires a URA chapter and verifies every referenced portrait's
bytes/hash before navigating. Missing, outdated, corrupt or offline-unavailable content shows an explanation and
retry without enrolling outfits or creating attempts; it never substitutes synthetic opponents. New attempts also
use this gate when reached directly. Existing checkpoints still load their exact retained content identity, including
legacy packs; missing retained versions show recovery instead of rerolling. No release flag is stored in the save.

T094 adds the lazy standalone **`/rpg/battle/:checkpointId`** stage (D243), not a Home or chapter launch action.
Five readable party cards carry portrait weapon/signature overlays, HP/MP, KO, acted and status labels. Attack,
equipped Skill and Guard use explicit actor/target selection; Details runs the pure reducer for legal targets and
projected cues, including enemy retaliation on the last ally action. Plans lists every enemy intent. The host
supplies the saved action count, replay cues/last action and acknowledged evidence, including a terminal replay
after a loss checkpoint has advanced its retry ordinal. Hit cues annotate their original channel/element/rider,
so a later intent or boss phase cannot mislabel damage; no combat formula or seed belongs to the screen.

The renderer journals first, then plays ordered transform/opacity cues using elapsed frame deltas. Input is locked
through playback; Skip, reduced motion, background and orientation changes affect presentation only. Reopening
restores the exact saved action prefix without replaying or submitting it again. Missing/corrupt journals, lease
takeover, Pending and Conflict each have explicit recovery screens. Pending results say **not yet earned** and have
no map/EXP/Item spend action. Accepted results display only their typed receipt. T096 adds its five-outfit progression
reveal and return-to-map/setup link without changing combat or adding save fields.
The battle guide reuses `PagedGuide`, with modal focus containment and accessible text for channels and matchups.

The DEV/TEST-only **`/dev/rpg-battle-proof?mode=practice|boss|loss`** uses invented mixed-weapon teams and a separate
`uma-rpg-battle-proof-v1` Dexie database. It cannot access account tables, enqueue commands or mint rewards. Each
mode resumes its own saved journal; its reset affects only that proof. Runtime portraits are optional presentation
references, never combat inputs; `art=off` makes screenshots fully synthetic. This route and its fixtures are absent
from the production build. [Phone proof](../research/rpg-battle-phone-proof.md) records both viewport checks.

## Chapters, content and reward boundary

- A chapter selects one of the existing scenarios as theme/reward destination. Every preset may launch any chapter;
  its recommended level, surfaces, dominant elements and boss are visible first. An authored path has branches, regular
  fights, optional recovery/setup points and a boss. The map is not a set of actual races that alter race history.
- A chapter run freezes its chapter definition/version/hash at start. Preset membership/order edits affect only
  future entries; each entered battle freezes party, class, weapon, element, stats and skills. **Existing members'
  signature/skill loadouts may be edited only at accepted safe checkpoints**, expecting that checkpoint's revision. Level-ups earned elsewhere while a
  preset is open must not retroactively alter a frozen battle. At the next safe checkpoint, show newly earned levels
  and allow loadout edits before the next encounter. Concurrent chapter edits must use an expected revision; stale
  copies cannot overwrite a later checkpoint or reward.
- The intended production opponents are **playable PriConne characters**, in curated teams throughout the map—not
  monsters with one occasional guest fight. [PriConne research](../research/uma-rpg.md) proposes frontline, caster,
  support, healer and pressure roles grounded in official character/skill references, but their Uma RPG rules are
  original. Engine tests use invented synthetic actors only. Exact character rows, art, battle kits and chapter
  rosters stay in private content, not git. Missing or outdated private content is surfaced clearly; no unrelated
  silent fallback duel.
- A branch preview identifies the opposing **character team**, formation/role icons, affinity risks and reward or
  recovery tradeoff. Each battle shows intent before commitment. Target order matters: a guard may protect a caster,
  a support may accelerate a finisher, or a healer may restore a ward. Elite teams can change formation or tactics at
  an HP threshold, but the shift is telegraphed and deterministic. Bosses are authored character encounters with a
  visible phase plan, not merely inflated HP. A loss resumes at a defined checkpoint without duplicating EXP or items.
  Candidate pacing is several brief normal team fights, one optional elite branch and one multi-phase boss per
  chapter; exact production counts and recovery points remain private authoring and reward tuning work.

### Implemented chapter map and boundary (T095, D245)

`packages/domain/src/rpg/chapter.ts` parses an immutable graph with known scenario, unique safe ids, resolved enemy
and art references, engine-compatible inline action/phase kits, one terminal boss, no cycles/dead ends and
complete reachability. Ordered enemy ids are the formation. Roles, elemental weaknesses and phase intents are
visible before entry. The [content-authoring contract](../technical/rpg-chapter-content.md) carries the exact schema,
an invented example, validation limits and the T096 fixture handoff. The lazy private loader verifies SHA-256 and
never substitutes a synthetic encounter when a pack or frozen version/hash is missing.

The internal lazy `/rpg/chapters/:presetId?chapter=<id>` map projects acknowledged per-preset/chapter checkpoints.
Starting needs five filled slots; a low average level warns but does not block. Selecting a chapter previews it;
Start/Resume explicitly changes that preset's foreground. Other saved chapters stay intact. An open foreground
fight must be explicitly paused/abandoned and acknowledged before switching: only its unresolved actions are
forfeited, not its entry, seed, kit, party or earlier rewards. Back/route changes alone keep the saved turn.

A finished battle cannot open a route. Its accepted winning `rpgResults` evidence is consumed by one expected-version
`choose-node` group (ordinary/elite) or `clear-chapter` group (boss), which appends the node, clears the entered kit
and marks the accepted checkpoint/clear. Safe branches, setup stops and rejoin points also use `choose-node`.
Pending start/entry/result/map groups remain visibly unaccepted; a pending local entry can still reopen its saved
battle. Duplicate or stale submissions cannot move the map twice. Explicit conflict recovery adopts accepted RPG
rows/evidence and discards rejected commands/dependants, retaining local journals instead of rebasing a rejected win.
Loss/abandon has zero rewards and retries the identical frozen encounter under a new retry ordinal. Only explicit
Replay after an accepted boss clear starts a new attempt and map.

The six-node DEV fixture has two required fights and one optional elite (route counts **[2, 3]**), one fork/rejoin,
a phase-changing boss and Tier 1 Lv10 recommendations. Its recovery stop is a safe setup/shorter route, **not** a new
persistent HP resource: every engine-v1 fight already starts at full HP/MP. T096 adds ordinary/elite/boss encounter
EXP and safe-checkpoint setup/promotion; T098 adds isolated Item/token grants. T097's private pipeline and real URA
chapter are implemented and published through T099 (D257). The isolated `/dev/rpg-chapter-proof` uses the real hosts with separate client/simulated-account
databases and invented rows only, excluded from production. [Phone proof](../research/rpg-chapter-phone-proof.md)
records 390×844/375×667 checks, acknowledgement, replay and recovery coverage.
- The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars unless a later decision explicitly
  changes that boundary. Chapter entry and retry cost **no Training Ticket or other entry currency**. Losing or
  abandoning returns to the last cleared map checkpoint; prior cleared nodes and rewards stay earned, while the
  unfinished encounter may be retried for free from its same frozen start. Switching to another chapter pauses this
  checkpoint rather than resetting it. **Only a voluntary replay after a completed boss clear** starts a new chapter
  attempt at its beginning; its new clear has its own idempotent reward identity.

## Inspiration rewards (D250)

The temporary [Inspiration advance](skills-and-inheritance.md#temporary-inspiration-advance-d256) does not change gross
rewards or costs. Each accepted reward first repays that scenario/family's negative bank, then deposits the remainder.
The checkpoint, bank, Item stock and ledger receipt commit together. Ledger `delta` remains gross; optional
`source.debtPaid` is the withheld portion (legacy entries mean zero), so Item reconstruction sums `delta - debtPaid`.
An unfinished advance blocks token collection until resumed; replay and another device never repay twice.

Global Items has **Inspiration Slot Token [Scenario]** and **Inspiration Skill Token [Scenario]**, never an RPG
wallet or Badge-page reward. One slot token opens one of an outfit's six parent/grandparent slots for that scenario;
one skill token opens one of two natural-gold positions per slot. Independent parents, exact opposite-side mirrored
grandparents and full-chain SP rules are defined in [Lineage](skills-and-inheritance.md#lineage).

- An accepted boss clear pays **30 slot tokens**: five outfits × six slots. A shortest completed chapter pays at
  least **60 skill tokens**: five × six × two golds. Thus five scenario chapters fund five outfits in each scenario,
  **150 slot + at least 300 skill tokens**, independent of level-relative EXP taper. Longer routes earn surplus.
- Let `n = minimum legal start-to-boss fight count − 1`. Each positive-authored-EXP ordinary/elite win pays
  `ceil(60 / n)` skill tokens. Optional fights use the same amount. Boss-only graphs pay 60 skill tokens with the
  boss instead. Safe nodes, missing/zero EXP entries, loss/abandon and legacy wrappers pay zero. The authoring graph
  must reward every fight on its shortest route; no live content or missing-pack fallback invents rewards.
- T098 freezes `{tier, slot, skill}` beside EXP and the unchanged engine input in combat-kit wrapper **v3**. Existing
  v1/v2 fights replay byte-for-byte and grant zero tokens, with no retroactive claim. Retries never recalculate from
  a new graph or re-roll. A voluntary new attempt uses current content and earns again under its new identity.
- Tokens collect on the **acknowledged winning map advance**, not the EXP result. Regular/elite use `choose-node`;
  boss uses `clear-chapter`. The group expects checkpoint and Item versions, consumes accepted winning evidence,
  updates stack(s), appends typed Item evidence and writes its receipt atomically. Movement ids are
  `rpg-inspiration:{entryId}:{slot|skill}`; the entry binds its chapter attempt and node. Duplicate tap/lost ACK never
  pays twice; stale checkpoint or Item leaves every write unchanged and requires explicit accepted-account recovery.
- Slot/gold purchases are one conditional `spend-inspiration`: Uma + correct scenario stack + one −1 movement;
  `inspiration:{umaId}:{tier}:{slot}:{slot|gold0|gold1}` identifies that permanent position. Pending grants and spends
  are visible but unavailable. Related ordinary Uma/Item edits wait until acknowledgement or conflict resolution.
  Item ledger reconciliation deduplicates evidence and repairs projections, even before Farm is initialized.
- Linked-portrait and four-point-skill **original SVG** crests distinguish the families by shape as well as color.
  Inspiration shows /6 slots, /12 golds, both stocks, token-specific confirmation and SP/mirror notes. Items names the
  scenario and links through the owned-Uma picker. Maps/results label previews, collection and accepted Items
  distinctly. Existing TL-open or filled-under-gate branches retain slots and both golds in v14 without token charges.
  D256's later, owner-requested one-time advance deliberately counts those already-open positions in its debt too.

## Phone presentation

At 390 × 844, the hub has one resume card per active preset, a prominent chapter/party action, and compact Roster and
Items links. The party setup uses five legible cards rather than five tiny portraits across one row. **Every RPG Uma
portrait, including map/party/combat/result variants, carries small visible overlays for its equipped weapon and
active element**: glyph plus short text/accessible label, with a toggleable affinity legend. The overlays cannot cover
the face or rely on two similar colors. The RPG profile makes outfit identity and RPG Level unambiguous.
The hub reads acknowledged foreground checkpoints beside its five presets and labels ready-party launch, saved
battle, accepted-result collection and cleared replay separately. Partial parties stay editable, not launchable.
Current publication failures still offer recovery for retained saved chapters. Explicit RPG account refresh updates
outfits, presets and checkpoints without clearing unrelated ordinary writes, pending RPG commands or device journals.
`RpgPortrait` is shared by hub/roster/profile/party/map/battle/result; it uses private bust/icon art with an honest
missing-art state and distinct weapon/element overlays. Compact hub cards also show outfit name, Tier and Level.
The roster and party editor expose a toggleable text advantage/affinity legend.

The roster uses **five square Uma icons per row**, icon-atlas art rather than large busts, with icon-only weapon and
default-signature overlays. Outfit names and compact Tier/Level captions remain below; full identities/statuses are
accessible labels. Unenrolled outfits have no invented weapon/element marks. Enrolled outfits come first, then those
not yet enrolled, alphabetically by outfit name within each group with an id tie-break. The Hub's existing resume
cards are unchanged.

Party outfit dropdowns offer only owned, enrolled outfits **not assigned to any other party or another slot in the
current draft**. Pending additions in another party reserve their outfits; saved members remain reserved until a
removal is acknowledged. Within the editor, the draft replaces its own saved membership so a removed member can
move to a different slot. The current selection stays visible even in previously shared presets; existing parties,
frozen battles and progression are never automatically cleared. This is a picker preference, not a new cross-device
save uniqueness invariant. To transfer between parties, remove and save first, then add to the destination party.
The [roster/picker phone proof](../research/rpg-roster-phone-proof.md) records the synthetic layout and filtering checks.

The battle stage keeps the current target, HP/MP, intent and weakness visible; actions occupy the thumb zone with
44 pt targets and `pb-safe`. The active fight does not page-scroll. Map and roster menus may scroll normally. Use
`m.*` under `LazyMotion strict`, transform/opacity animations and delta-timed effects; respect reduced motion. The
route and any PixiJS scene stay lazy so startup remains ≤180 KB gzip. One shared nine-page `RpgGuide` reuses
`PagedGuide`, `RpgModalFocus` and resilient device-local guide memory. It opens once from the hub and is always
reachable there, from the map and from battle; contextual entry begins on the appropriate page immediately.
It explains party/class choice, weapons/affinities, action/MP channels, advantage, support/KO, offline/retry/takeover,
EXP/skills/promotion and scenario tokens/advance repayment/Inspiration SP. The guide never issues a game command.
DEV-only layout/chapter proofs and invented roster imports are excluded from the production route graph and build.

## Relationship to existing systems and delivery order

This is a **persistent global campaign**, like Farm in scope, not a ticketed `MinigameHost` run. The shared
[Minigame kit](minigame-kit.md) supplies useful standards—pure engine, deterministic replay, private content,
mobile safe areas, guide, result clarity—but its one-ticket reservation, 64-action journal and unsynced terminal
run lifecycle cannot simply be imposed on a multi-fight chapter. The design must explicitly define its own save and
sync contract before implementation. Farm already owns global Items; the RPG uses the same stacks and ledger, not a
  second reward wallet. Inspiration uses the implemented token sink and grandfathered v14 migration below; no TL
gate remains on lineage ([Constellations](constellations.md#unlock-schedule)).

M028's first playable RPG was delivered as T089–T099 (specs retained in git history), followed by
[M029 — chapter rollout](../tasks/M029-rpg-chapter-rollout.md), T100–T103, covering the other thirteen current
scenarios. The [technical contract](../technical/uma-rpg-implementation.md) specifies state ownership, grouped
transactions, replay and handoffs. The first PRs settle balance and persistence with synthetic fixtures; later PRs
build the battle, chapter, progression, private-content and Inspiration bridge. The Home entry cannot enter the mode
until its real chapter and art verify. D257 authorizes release before physical-iPhone and real-account gameplay
acceptance: those checks remain explicitly open in the [standing record](../research/rpg-release-acceptance.md),
not passed by a synthetic browser proof. Each task updates this design when a candidate rule becomes
settled, appends a decision for new rules, pins changed numbers in `packages/domain/src/domain.test.ts`, and runs
lint, test, build and relevant RPG simulations. Original-game and PriConne content stays private throughout.
