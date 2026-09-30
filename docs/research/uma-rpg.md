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
design should let a dual-A Uma **choose one role** without forcing a party quota. End follows the same role and party
rules as every other style; the owner expects to unlock more End outfits through normal collection.

Medium-A is common (214/268), so giving Medium two distinct elements is a strong variety lever. However, **element
access is not equivalent to elemental power**: whether Medium also gets the best spell tier should wait for a skill
catalog and encounter simulation. The proposed distance→element mapping is the owner's intended starting point, not a
fact about the source game.

## PriConne enemy direction — monsters and guest duels

The owner prefers *Princess Connect! Re:Dive* (PriConne) over an unrelated generic monster pack. Cygames itself
supplies two useful lanes: its [Clan Battle boss notices](https://priconne-redive.jp/news/event/37700/) name recurring
monster opponents and distinguish physical/magical attack and defense; its
[character directory](https://priconne-redive.jp/character/) and
[official anime cast list](https://anime.priconne-redive.jp/archive/1st/character/) identify recognizable characters.
The proposed story framing is **monster encounters along a route, then an authored sparring/guest duel** with a core
PriConne character or team. Calling those characters opponents need not portray the protagonists as villains.

### Candidate ordinary monsters

The [September 2026 official Clan Battle notice](https://priconne-redive.jp/news/event/37700/) names five bosses. The
observed attack channels and multi-target layouts below come from that notice; the **RPG hooks are our own proposed
adaptations**, not copied abilities or stats.

| Public reference | Observed hook | Proposed Uma RPG encounter job |
|---|---|---|
| **Frost Hound** | Magic attack; multi-target body | Teaches magical-defense/ward planning and target selection across parts. |
| **Jackal Thief** | Physical attack | A fast striker that warns whom it will attack; test Paladin protection and defensive skill choices. |
| **Land Sloth** | Both physical and magical attack | Changes posture between two clearly telegraphed attack channels. |
| **Dark Gargoyle** | Both channels and strong defenses | A defensive mini-boss that rewards marks, debuffs and varied damage channels. |
| **Glutton** | Multi-target body | A boss whose parts offer a path choice: reduce pressure or rush the main target. |

The notice's **own** weaknesses include Wind and Water, which do not match Uma Racer's Fire/Ice/Lightning/Light/Dark
proposal. Do **not** copy or silently rename those affinities; a private author explicitly assigns each encounter a
new weakness/resistance profile for this mode and documents it in the private pack. No Cygames HP, attack, defense or
level values are reused. Those values are from a different balance system and would overwhelm this RPG's small scale.

### Candidate named guest encounters

The official cast confirms names, while Cygames' own [skill wording](https://dmg.priconne-redive.jp/news/detail.php?id=10897)
and [balance notes](https://priconne-redive.jp/news/information/35036/) give grounded *motifs*. These are a shortlist
for private authoring, not checked-in enemy definitions:

| Public character | Source-supported motif | Proposed Uma RPG duel (new mechanics) |
|---|---|---|
| **Pecorine** | Physical damage, defense and self-sustain in [Cygames' skill notes](https://dmg.priconne-redive.jp/news/detail.php?id=5294). | Frontline guest with telegraphed guard and a recoverable break window. |
| **Karyl** | Magical attack with magical-defense reduction in [Cygames' skill notes](https://dmg.priconne-redive.jp/news/detail.php?id=10897). | Caster guest who marks a target before a burst; counter with defense/interrupt timing. |
| **Kokkoro** | Ally-enhancing support in [Cygames' balance notes](https://priconne-redive.jp/news/information/35036/). | Support guest who strengthens another foe; party may focus her or endure the buff. |
| **Yui** | Barriers and resource support in [Cygames' balance notes](https://dmg.priconne-redive.jp/news/detail.php?id=37312). | Protective guest who tests ward breaking and healing pressure. |

The individual motifs are **not** an instruction to replicate a proprietary skill name, animation, coefficient or
move list. A chapter might pair one guest with two ordinary monsters, or reconverge two paths on a named team duel.
Its enemy intent, group composition, level band and affinity should be visible before the player commits to the path.
The first production publish should author a small vertical slice of one chapter, then expand across scenario maps;
it should not claim all fourteen chapters are covered by one repeated four-character lineup.

### Private content contract

Each authored encounter needs a stable private id, content version, art key, display label, combat role/channel,
adapted element/weakness/resistance, bounded action list with telegraphed targets, and optional boss phase. The pure
engine uses synthetic shape-compatible fixtures; import/publish validation checks that every chapter node resolves
and that every opponent has a renderable art fallback and legal actions. No network or third-party content is used in
tests. Which guest forms, exact artwork and additional monsters to publish remain private-content authorship choices.

The personal-only nature of Uma Racer does not change its repository rule: extracted names-as-data, images, sprites,
packs and caches stay under gitignored `/content/` or script caches, never in git. Checked-in fixtures must be small
and synthetic. The design and tests must work with a synthetic enemy catalog before any PriConne pack is available;
production must say when a private chapter pack is missing rather than silently substituting unrelated fights. A
[CC0 monster-builder pack](https://kenney.nl/assets/monster-builder-pack) exists as an optional visual fallback for
original placeholder encounters, not as a replacement for the owner's chosen direction.

## Research conclusions

1. Lead with **five party slots** as a proposal: a Greatsword Front, flexible physical/support Pace and magical
   offense/support Late, and a Tome End make a natural mix; no slot is hard-typed. Test five against four at 390×844 before
   locking the count.
2. Make weakness, enemy intent, weapon, element and recovery readable before the action. Strategy should not depend
   on memorizing an unseen chart.
3. Keep the map and battles short enough to resume on a phone. A chapter can be a long-term campaign without making
   every individual encounter a long session.
4. Keep this mode's levels and EXP per outfit, global across all parties/chapters, and do not turn it into a second
   source of racing or Training EXP.
