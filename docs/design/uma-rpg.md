# Global Uma RPG — first design draft

> **Status: proposal, not implemented.** The owner has fixed the mode's global scope, outfit-specific RPG levels,
> Speed-as-offense mapping, a permanently chosen running-style class, visible weapon/element identity, and
> inventory-only destination for its future rewards. Level 50 is a repeatable **class-promotion point**, not a final
> cap. Five filled party slots, the signature-element choice and the Inspiration token destination are fixed.
> Encounter math, the leveling curve, exact skill catalog and chapter length still need bounded tuning before
> any engine/save migration is implemented.

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
  navigation is **Map · Parties · Roster · Items/Records** (names provisional). No sixth bottom tab.
- Five named presets are account-wide quick configurations. A preset saves member order, signature element and RPG
  skill loadout for each slot; an outfit's style and current weapon path live on its RPG profile, not independently
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
  A path reconverges before a named boss. Chapter length, number of fights and replay **EXP** are not yet fixed;
  the scenario-token clear reward is fixed below.
- After a fight, the result shows each participating outfit's RPG EXP, new level, stat changes and newly available
  skill slots/tiers in a Fire Emblem-like reveal. The player can open skill setup before choosing the next map node.
  Chapter clear pays its defined RPG reward; the scenario-linked **Inspiration Unlock Token [Scenario]** goes straight
  to the global Item inventory. Its future Inspiration use is defined below, not on the card Constellation.

## Outfit RPG profile and progression

An owned outfit has one class tier, level and EXP track shared by every preset and chapter. Different outfits of the same character
have different RPG levels, as in Farm; there is no scenario-specific RPG copy. An RPG profile shows its class, chosen
weapon, active element, available element affinities, skill slots, level/EXP and combat attributes. Only the RPG area
shows RPG Level. Racing and Farm values are read as inputs where specified, never mutated by RPG fights.

| Existing Uma input | RPG attribute it informs | Intent |
|---|---|---|
| **Speed** (base stat + growth) | **Physical ATK and magical MATK** | The owner's core mapping: Speed is the main race-winning stat, so it should drive both offensive routes. |
| **Stamina** | Initiative / action speed, with HP or endurance contribution to be decided | Stamina enables longer efforts in racing; it should not quietly replace Speed as the primary damage stat. |
| **Power** | Physical DEF, guard strength | A sturdy physical role. |
| **Guts** | Dexterity / critical reliability | Precision and clutch effects, not another raw ATK stat. |
| **Wit** | MP and magical resource economy | A visible reason to value Wit on caster and support builds. |

The conversion reads the outfit's **base racing stats and growths**, not its mutable scenario constellation or Produce
assignments, to keep this global profile stable when the player switches scenarios. Level-up gains are deterministic,
never a hidden random stat roll. At RPG enrollment the player chooses one eligible running-style class and one weapon
path for that outfit. The **running style is permanent** across presets, chapters and promotions; a dual-A racing
outfit does **not** level multiple style classes or switch between them. The selected weapon path stays with that outfit
through chapters and promotions in the first delivery, so there is only one active weapon × element matrix. A later
within-style respec would be a separate design change, not parallel progress. Multiple aptitudes create breadth in
the *elemental* trees instead.

### First balance candidate: repeatable class tiers and stats

This is a **simulation candidate, not an approved tuning pin**. Each outfit starts at **Class Tier 1, Lv1**. Lv50 is
the end of one tier's learning arc; after resolving its pending EXP and skill choices, the player may **promote** to
Tier 2, Lv1, then Tier 3, and so on. There is no planned final tier. Promotion never changes the locked running style
or erases earned stats, and never changes race Uma Level or Farming Level. The selected weapon path also carries
forward; a future within-style respec is outside this first delivery. The initial pacing target is
**roughly ten RPG levels per scenario-length chapter**, so a five-scenario block roughly fills one 50-level tier;
fourteen current scenarios would give about two promotions and progress deep into Tier 3. This is a pacing target,
**not** a chapter-order gate: any party may enter any chapter, and replay/catch-up rewards must respect the outfit's
current tier and level. Future scenarios extend the loop without a schema cap.

| Measure | Candidate rule | What the player sees |
|---|---|---|
| Tier-local level | `1…50`, per owned outfit, followed by an explicit promotion into the next tier | `Tier 2 · Lv1` is visibly stronger than `Tier 1 · Lv50`; the profile also shows lifetime promotions. |
| EXP to next level from current level `L` | Keep the draft `100 + 18L + 2L²` for `1 ≤ L < 50` **only as a first simulation input** | 120 from Lv1→2, 480 from Lv10→11, 1,260 from Lv20→21, 5,784 from Lv49→50; 107,800 per tier before reward scaling. |
| Permanent core RPG stat `s` | `round(B_s / 5 + N × 1.5 × (1 + G_s))`, with `N = 50 × (tier − 1) + (L − 1)`; `B_s` is base racing stat, `G_s` stored fractional growth (`0.2` means +20%) | Five deterministic values derived from lifetime promoted levels, not mutable random rolls. Promotion advances `N` from 49 to 50 and cannot lower a stat. |
| Combat projection | ATK/MATK from RPG Speed; initiative and part of HP from RPG Stamina; PDEF/guard from RPG Power; dexterity from RPG Guts; MP/support capacity from RPG Wit | Weapon channel decides which offensive value is used. |

A small arithmetic check of that **candidate** curve gives 2,760 / 8,760 / 18,760 / 32,760 / 44,760 EXP for
roughly ten-level stretches across one tier (Lv1→11, 11→21, 21→31, 31→41, 41→50). Equal chapter payouts therefore
**would not** yield the intended pace; encounter/chapter EXP must rise with recommended tier-local level, and the
two-tier sanity test should reject a curve that needs an unreasonable payout jump.

For a **synthetic** outfit with base Speed 100 and growth `0.2`, RPG Speed would read 20 at Tier 1 Lv1, 22 at Lv2,
108 at Tier 1 Lv50 and **110 at Tier 2 Lv1**. That example is invented, not copied from private Uma data. A promotion
result shows the exact five-stat carry-forward and any new tier bonus; no retroactive stat reroll. If the linear
lifetime gain makes later tiers too strong, tune the projection/enemy scale in simulation rather than resetting earned
stats. HP, MP, magical defense, damage and any tier bonus still need their own formulas and pinning tests.

EXP is awarded after a resolved battle to participating outfits and optionally at chapter clear, with one idempotent
grant per encounter/clear. Level-relative rewards should accelerate catch-up and taper farming weak chapters, but must
not prevent a player from progressing. EXP earned at Lv50 **banks** until the player promotes; promotion then applies
that bank to the next tier without loss or duplicate grants. A KO'd member's participation rule and repeat-clear reward
need explicit decisions. The result names every crossed level, exact stat changes and new skill choices. A **small,
synthetic two-tier sanity simulation** should check five-chapter pacing, one overleveled replay, one catch-up party and
no stat/EXP loss on promotion; it need not exhaustively solve every party. Pin the finalized curve before implementation.

### First balance candidate: skill trees and tier renewal

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
The exact depth gates, slot ladder and point costs still need a focused specialization-versus-breadth check and
pinning before implementation.

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
opens only lower-depth skills of that **same weapon**, never its fifth-depth signature or an alternate weapon tree.
One or two lower-depth B side nodes for coverage/utility remain a focused balance option, not a higher tier. A
multi-A outfit can specialize two elemental cells or spread points widely, but cannot automatically master every
cell in a single tier.

Promotion opens a **fresh Tier 2 matrix** for the selected weapon path and eligible elements: no unspent Tier 1 point
silently turns into a Tier 2 point, and Tier 2's tree choices begin empty. Previously learned skills remain visible as
**legacy techniques** and usable in a loadout until replaced; otherwise promoting would make a stronger outfit unable
to fight. Their prior levels/branches do not auto-unlock Tier 2 equivalents. New-tier techniques may adapt the cell's
effect and offer a different branch choice, while the old tier's mastery stays recorded for history and presentation.
At promotion, a small **class-mastery variant** is a candidate choice for the *new tier's* weapon skills—for example,
Greatsword pressure versus a wider cleave, or Paladin stronger protection versus a modest heal. It changes a tactical
rider, not the locked style, damage channel or base-stat growth; variants do not stack without bound across promotions.
The exact menu and effect sizes need combat simulation before pinning.
Balancing must prevent an ever-growing legacy catalog from swamping the loadout; active slots are bounded and any
eventual legacy-slot restriction needs its own decision. A battle freezes its entrant's tier, stats and loadout.
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

At setup, the outfit chooses **one signature element from its permitted affinities**. It determines the portrait
overlay and specialization, but never prevents equipping other eligible elements. The owner's **10% specialization
bonus** is the starting balance candidate for the selected class weapon and signature element. It must not
double-count one elemental action. The exact affected outcome, rounding and interaction with advantage and a physical
elemental rider need one focused combat check and a pinning test before implementation. Two A styles do not grant two
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
the outfit may equip skills from every eligible affinity, subject only to the RPG skill slots/tier rules. The exact B
side-node catalog and tier ladder await focused tuning. **Turf/Dirt aptitude does not gate the RPG element trees** in
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

The triangle direction above is a **provisional** choice; no advantage multiplier is fixed. The combat UI always
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

## Five-member combat proposal

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

The first combat slice should prove: Front Greatsword is strong but strictly physical; Pace Spear and Paladin have
different physical plans; Late Wizard and Cleric have distinct magical offense/support; End Tome is strictly magical;
and every element's weakness matters. Persona's extra-action-on-weakness is a promising **candidate**, not a decided rule: if
five actors can chain indefinitely, fights become trivial. Prototype a bounded follow-up or momentum action and
compare it with no extra action. Enemy intent is revealed before commitment; no hidden reroll after reload.

Combat rules are pure TypeScript in `packages/domain`; presentation can use React for menus and PixiJS only if a scene
actually benefits from many animated actors. Rules consume a frozen encounter/content version, deterministic seed and
player actions. The screen animates the engine's result, never decides it. A **synced chapter checkpoint** stores the
last cleared node, frozen chapter version, party/kit snapshot, and any entered battle's stable identity and seed. The
active battle's action journal is device-local, so reopening on the **same device** restores the exact turn and
targets. A second device or reinstall must show that a battle was in progress and offer an explicit **restart from
its frozen entry state**; it may not silently reroll enemies, content, seed, or rewards. A versioned takeover makes
the former device stale before it can commit. Results grant EXP/items once by encounter/clear identity; navigation,
retry and reconnect cannot claim twice. Battle actions may not require a network round-trip.

## Chapters, content and reward boundary

- A chapter selects one of the existing scenarios as theme/reward destination. Every preset may launch any chapter;
  its recommended level, surfaces, dominant elements and boss are visible first. An authored path has branches, regular
  fights, optional recovery/setup points and a boss. The map is not a set of actual races that alter race history.
- A chapter run freezes its chapter definition and membership/class/weapon/element at start. **Skill loadouts may be
  edited only between battles**; each battle freezes the loadout that entered it. Level-ups earned elsewhere while a
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
  chapter; exact counts and recovery points need phone prototyping and simulation.
- **Inspiration Unlock Token [Scenario]** is one scenario-typed global Item stack, not a Badge-page award. **Every
  successful clear, including a replay, grants one token** for that chapter's scenario with append-only evidence
  transactionally coupled to that clear attempt. A failed or abandoned battle/chapter grants no clear token. One token
  is consumed to unlock **one complete parent branch** for one Uma in that scenario: the parent node and its two
  linked grandparent nodes. Thus fully opening
  both parent branches for that Uma/scenario costs **two tokens**. There is no card Constellation node unlock or
  Training Level prerequisite in this future rule; filling and changing lineage assignments remain separate actions.
  The Item view displays the scenario in square brackets, and the Inspiration view shows 0/2, 1/2 or 2/2 branches
  open with a token-spend confirmation. Existing branches opened under today's TL9/10 rules must be grandfathered by
  migration, never relocked or charged retroactively. This sink is a **future Inspiration bridge**, not live behavior.
- The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars unless a later decision explicitly
  changes that boundary. Chapter entry and retry cost **no Training Ticket or other entry currency**. Losing or
  abandoning returns to the last cleared map checkpoint; prior cleared nodes and rewards stay earned, while the
  unfinished encounter may be retried for free from its same frozen start. Switching to another chapter pauses this
  checkpoint rather than resetting it. **Only a voluntary replay after a completed boss clear** starts a new chapter
  attempt at its beginning; its new clear has its own idempotent reward identity.

## Phone presentation

At 390 × 844, the hub has one resume card per active preset, a prominent chapter/party action, and compact Roster and
Items links. The party setup uses five legible cards rather than five tiny portraits across one row. **Every RPG Uma
portrait, including map/party/combat/result variants, carries small visible overlays for its equipped weapon and
active element**: glyph plus short text/accessible label, with a toggleable affinity legend. The overlays cannot cover
the face or rely on two similar colors. The RPG profile makes outfit identity and RPG Level unambiguous.

The battle stage keeps the current target, HP/MP, intent and weakness visible; actions occupy the thumb zone with
44 pt targets and `pb-safe`. The active fight does not page-scroll. Map and roster menus may scroll normally. Use
`m.*` under `LazyMotion strict`, transform/opacity animations and delta-timed effects; respect reduced motion. The
route and any PixiJS scene stay lazy so startup remains ≤180 KB gzip. A short in-mode guide uses the existing paged
guide pattern and explains class choice, elemental triangle, Light/Dark, MP, resume and reward destination.

## Relationship to existing systems and delivery order

This is a **persistent global campaign**, like Farm in scope, not a ticketed `MinigameHost` run. The shared
[Minigame kit](minigame-kit.md) supplies useful standards—pure engine, deterministic replay, private content,
mobile safe areas, guide, result clarity—but its one-ticket reservation, 64-action journal and unsynced terminal
run lifecycle cannot simply be imposed on a multi-fight chapter. The design must explicitly define its own save and
sync contract before implementation. Farm already owns global Items; the RPG uses the same stacks and ledger, not a
second reward wallet. **Today**, the implemented Inspiration lineage branches still open at TL9/10
([Constellations](constellations.md#unlock-schedule)). The token sink above is a **future change** to those unlock gates,
owned by an Inspiration/inventory bridge with save migration; merely granting tokens in the RPG must not leave them
unspendable or silently alter live Training Level rules.

The proposed sequence is deliberately **not yet numbered into implementation tasks** while concurrent work is in
flight and the remaining technical/tuning gates below need validation:

1. **Rules and save contract:** pin five-member eligibility, aptitude rules, lightly test level/stat and tree curves,
   define combat math, chapter checkpoints, cross-device takeover and item identity with synthetic fixtures.
2. **RPG roster and presets:** global hub, five named presets, outfit profiles, class/weapon/element setup and portrait
   overlays, with complete reload/sync tests.
3. **Battle vertical slice:** pure deterministic engine, synthetic character-team fixtures exercising guard, caster,
   support, heal and weakness tactics; phone battle UI, resume and idempotent result.
4. **Map and private content:** branch/reconverge chapter engine, playable PriConne opponent packs, art import and
   validation, level warnings, telegraphed boss phases, guide and readable battle previews. Production content is a
   separate private publish.
5. **Progression and inventory:** tier-local EXP/level-up reveal, branching elemental trees and promotion carry-over,
   preset checkpoint resume, scenario token grant into global inventory, idempotent conflict/replay checks and the
   Inspiration bridge that replaces TL gates without relocking already-open branches.
6. **Device acceptance:** 390×844 and small-iPhone screenshots, VoiceOver/reduced-motion, background/reload/offline,
   long chapter, party switching, clear/retry and owner physical-iPhone sign-off.

The full milestone should get task IDs and one PR per delivery slice only after those implementation gates are scoped.
Implementation must then update this design doc, append decisions, pin each numeric rule in
`packages/domain/src/domain.test.ts`, and run lint, test, build and a dedicated RPG simulator.
