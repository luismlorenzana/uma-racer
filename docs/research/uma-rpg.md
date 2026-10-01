# Global Uma RPG — reference and roster research

Research for the [Global Uma RPG first draft](../design/uma-rpg.md), reviewed 2026-09-30. This is a proposed account-level,
turn-based campaign with owned Uma outfits as party members. It is not a claim that the mode, chapter content, or rewards
exist in the app today.

## Which references fit?

| Reference | Useful observation | Adaptation | Do not copy |
|---|---|---|---|
| [Persona 5 Royal](https://persona.atlus.com/p5r/index.html) | Targeting an enemy weakness is a visible tactical payoff and can grant another action. | Show enemy affinity and intent, make a weakness hit tactically meaningful, and let party composition create deliberate chains. The exact extra-action rule needs simulation. | Calendar, social links, dungeon length, Persona fusion, or its characters/assets as checked-in data. |
| [Fire Emblem Heroes](https://fire-emblem-heroes.com/en-gb/beginners) | Phone-friendly team presets, a readable matchup triangle, and less EXP for defeating weaker foes. | Saved party presets, a clear elemental legend and pre-battle matchup preview, with level-relative RPG EXP. | Gacha, stamina, grid movement, PvP, or mandatory one-of-each classes. |
| [Octopath Traveler II](https://www.square-enix.com/asia/newsportal/en/sg/octopathii/) | Jobs, weaknesses and the Break/Boost rhythm make every member's role legible. | A possible future guard-break meter and meaningful weapon/element coverage. | Its full job system and the complete Break/Boost economy in v1. |
| [Fire Emblem Heroes skill sets](https://new-guide.fire-emblem-heroes.com/en-US/feh-2230.html) | Saved equipment/skill configurations reduce between-battle menu friction. | Five named Uma-party presets and an explicit skill-setup checkpoint after a fight. | Automatic equipment changes that silently alter an already-started fight. |

The **best initial combination** is Fire Emblem Heroes' compact preset and matchup presentation, Persona's weakness
payoff, and a chapter map with meaningful branches. Break meters and multi-stage combo systems are later candidates,
not prerequisites for the first playable loop.

## What the private Uma roster actually says

Aggregate only, computed from the existing local private Uma pack on 2026-09-30. An outfit is counted once in every
aptitude where it has grade **A**, so these columns overlap. The sample is 268 outfits / 135 characters; the starter
subset has 25 outfits. No private rows or extracted identifiers are reproduced here or added to git.

| A aptitude | All outfits | Starter outfits |
|---|---:|---:|
| Front | 47 | 5 |
| Pace | 161 | 16 |
| Late | 136 | 13 |
| End | 37 | 1 |
| Sprint | 34 | 4 |
| Mile | 101 | 8 |
| Medium | 214 | 19 |
| Long | 103 | 10 |
| Turf | 251 | — |
| Dirt | 23 | 1 |

The concern about Pace/Late double counting is real: **69 of the 136 Late-A outfits also have Pace-A**. Of those, 66
have exactly Pace+Late; seven of the thirteen starter Late-A outfits also have Pace-A. Exact style masks in the full
pack are: Pace only 72, Pace+Late 66, Late only 46, Front only 27, Late+End 20, Front+Pace 19, End only 13, and six
spread across three rarer combinations. Counting Pace and Late as two distinct armies would exaggerate choice. The
design should let a dual-A Uma **choose one role at RPG enrollment and lock it for that outfit** without forcing a
party quota. The overlapping running styles do not create parallel class trees. End follows the same role and party
rules as every other style; the owner expects to unlock more End outfits through normal collection.

Medium-A is common (214/268), so giving Medium two distinct elements is a strong variety lever. However, **element
access is not equivalent to elemental power**: whether Medium also gets the best spell tier should wait for a skill
catalog and encounter simulation. The proposed distance→element mapping is the owner's intended starting point, not a
fact about the source game.

## PriConne enemy direction — playable characters as the cast

The owner clarified the crossover: **PriConne's playable characters are the recurring enemies**, not a monster
route with occasional guest duels. The [official character directory](https://priconne-redive.jp/character/) and its
[Gourmet Guild page](https://priconne-redive.jp/character/gourmet_guild/) establish character identities and available
portrait sources; the [official anime cast list](https://anime.priconne-redive.jp/archive/1st/character/) shows how
many recognizable teams are possible. Cygames' [balance notes](https://priconne-redive.jp/news/information/35036/)
and [skill notices](https://dmg.priconne-redive.jp/news/detail.php?id=5294) support broad battle-role motifs. None of
these pages supplies Uma Racer balance values, elemental affinities or permission to copy source combat formulas.
The story can frame opponents as tournament rivals or friendly challenge teams, not automatically villains.

### Candidate character roles and teams

These are public research pointers for **private** encounter authorship, not checked-in roster rows. The right-hand
column is *our inference/design proposal* from the cited motif, not a claim about PriConne's actual encounter logic.

| Public character | Source-supported motif | Proposed Uma RPG encounter job |
|---|---|---|
| **Pecorine** | [Physical damage/defense and self-sustain](https://dmg.priconne-redive.jp/news/detail.php?id=5294). | A frontline guard who protects a fragile ally; telegraph a short break window after her heavy attack. |
| **Karyl** | [Magical attack and magic-defense reduction](https://dmg.priconne-redive.jp/news/detail.php?id=10897). | A caster who first marks a target, then threatens a delayed burst; guard or disrupt the setup. |
| **Kokkoro** | [Team-enhancing support](https://priconne-redive.jp/news/information/35036/). | A tempo support whose visible buff strengthens the next enemy action, making target priority meaningful. |
| **Yui** | [Barriers and resource support](https://dmg.priconne-redive.jp/news/detail.php?id=37312). | A ward/heal specialist: choose whether to break a ward, pressure another enemy, or save MP. |
| **Tomo** | [Repeated physical strikes and multi-target pressure](https://priconne-redive.jp/news/information/35036/). | A fast attacker whose marked lane receives several smaller hits; test guard versus counterattack. |
| **Hatsune** | [Magic offense and debuff interactions](https://priconne-redive.jp/news/information/35036/). | A spellcaster who changes target priority if the party has little magical cover. |
| **Yukari** | [Growing support effects](https://priconne-redive.jp/news/information/35036/). | A support whose repeated actions build a visible threat; a reason to end a fight before full ramp. |

An opening chapter could use **Kokkoro + Tomo** to teach support/physical focus, then offer a route fork between
**Pecorine + Yui** (guard/ward attrition) and **Karyl + Hatsune** (magical burst), reconverging on an authored
**Pecorine + Karyl + Kokkoro** boss team. This is a candidate *composition*, not source-game canon or a production
roster. The five-element weaknesses, target intent and statuses are authored for Uma Racer, with no imported Cygames
damage, skill names, coefficients or action rotations. Expand beyond this first small cast only after a complete
private chapter is fun and readable; fourteen scenarios must not all recycle the same four names.

### Battle hooks worth testing

- **Visible role synergy:** an enemy support announces whom it will buff; a guard visibly intercepts; a marked caster
  announces the target of the next burst. The player can remove the enabler, defend, or exploit an elemental weakness.
- **Formation and focus:** frontline protection has a clear rule and an exposed counter-window. A five-Uma party has
  choices beyond hitting the lowest HP bar, but target legality remains readable on a phone.
- **Branch identity:** the map previews enemy portraits, role icons, likely affinity family, level and recovery tradeoff
  before a fork. A route rich in wards favors different elements/classes than one rich in physical pressure.
- **Boss phases:** a named team changes *one* telegraphed tactical relationship at a time (for example guard switches
  to protect Karyl after Pecorine's threshold), not arbitrary hidden buffs. A phase transition is deterministic and
  recoverable from replay. Weakness follow-ups must be bounded so a five-member party cannot take infinite turns.
- **Failure and return:** a loss or phone interruption restores the same encounter/checkpoint and never pays EXP or
  Items twice. A safe checkpoint allows skill-tree/loadout choices after level-up, never mid-action.

### Private portrait and encounter import plan

The [official character pages](https://priconne-redive.jp/character/) are **candidate source pages**, not proof that
every desired image is directly downloadable at a usable resolution. Before production authoring, inspect each
character page's actual image links, dimensions, variant labeling and reliability; record a source URL and provenance
for each chosen visual. A small private manifest under gitignored `/content/overrides/` should map a stable local
character/variant id to source URL, display label, chosen crop/pose and encounter role. The existing private
`scripts/data` / `scripts/assets` pipeline can then validate ids, download/cache permitted source files, make mobile
WebP portraits/atlases and publish the versioned pack into the **private** content bucket through the established
owner-controlled content path. Do not assume the existing GameTora parser understands PriConne HTML; the importer
will need a separate adapter and a fail-closed validation step. No art, extracted roster, cache or generated pack is
committed to git, and the app loads the pack only through the signed-in private-content route.

Each authored encounter needs a stable private id, content version, opponent variant/art keys, display labels,
combat role/channel, *adapted* element/weakness/resistance, bounded action list with telegraphed targets, formation,
optional phase plan and reward identity. Import/publish validation checks that every chapter node resolves, every
opponent has a renderable art asset and every action is legal. The pure engine and checked-in tests use **invented
synthetic actors** with shape-compatible data; no network or third-party content is used in tests. A missing or
outdated production pack is a visible content error, never a silent generic-monster replacement. This whole source
and publish step remains private content work, not a normal code PR.

## Research conclusions

1. Lead with **five party slots** as a proposal: a Greatsword Front, flexible physical/support Pace and magical
   offense/support Late, and a Tome End make a natural mix; no slot is hard-typed. Test five against four at 390×844 before
   locking the count.
2. Make weakness, enemy intent, weapon, element and recovery readable before the action. Strategy should not depend
   on memorizing an unseen chart.
3. Keep the map and battles short enough to resume on a phone. A chapter can be a long-term campaign without making
   every individual encounter a long session.
4. Keep this mode's tier-local levels and EXP per outfit, global across all parties/chapters. Lv50 is a promotion
   transition that preserves earned stats and starts a fresh elemental matrix for the **same locked class**, not a
   permanent level cap or a second running-style progression track. Do not pay racing or Training EXP.
5. Make playable PriConne characters the normal enemy cast and bosses. Source names/visuals only through private
   content; author new combat rules and test with synthetic actors before any private pack is available.
