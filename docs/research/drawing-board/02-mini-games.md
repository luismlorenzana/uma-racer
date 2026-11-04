# 02 · Mini-games for the 2026-11-04 redesign

Research only (2026-11-04). It covers mini-game design and tech. The original game's careers and scenarios are another
report's job, and so is the old Uma Puzzles code ([03](03-racer-today.md) §3). Session lengths are approximate.
**(guess)** marks a claim I couldn't confirm in a source.

## 1. Genre shortlist for 3–7 minute, portrait, one-thumb stages

A stage of 3–7 minutes is longer than most phone mini-games last. So most genres reach it by chaining short units: two
songs, three boards, six rounds or one battle. Cost assumes one developer with AI help; art is usually the biggest cost.

| Genre | Shipped reference | Why it works on a phone | Unit / stage | Ceiling | Replay | Cost | Uma fit |
|---|---|---|---|---|---|---|---|
| **Rhythm tap** (1–3 lanes) | Rhythm Heaven, Project Sekai, Arcaea | Taps on the beat; works with one thumb if the lanes are narrow | Song 2–3 min, two per stage | High | High (charts) | Med (audio sync, charts) | **Very high**: Winning Live |
| **Timing bar / power meter** | Uma's own claw machine, golf meters | One verb (hold, release) and instant feedback | 5–20 s a shot, 12–20 shots | Med | Med | **Low** | High: gate break, whip, spurt |
| **Lane-switch runner** | Subway Surfers | Swipes come naturally; reaction play | Endless 1–5 min; a fixed course of 3–5 min | Med-high | Med | Med-high (art) | High: dodge, draft, find gaps |
| **Steering a racing line** (drag) | Alto's Adventure, Tiny Wings (one-touch momentum) | Analogue control with one finger | Course 1–2 min, three per stage | High | High (courses) | Med | **Very high**: the inside rail, corners, positioning |
| **Peg / pachinko physics** | Peglin | Aim and launch, then watch | Board 1–2 min, three boards | Med (luck) | High with a build layer | Med (deterministic physics is hard) | Medium: "carrot drop" |
| **Catch / collect** | Countless; the claw machine is related | Drag a catcher; easy to read | 30–60 s waves | Low-med | Low | **Low** | Medium |
| **Stacking / drop timing** | Tower Bloxx-likes | One tap | 1–2 min | Med | Low-med | **Low** | Low (a hay-bale or cake tower) |
| **Flick / aim** | Desert Golfing, Golf Story | Slingshot gesture | Seconds a shot | Med | Med | Low-med | Low-med |
| **Deckbuilder battle** | Slay the Spire, Balatro (a 2–5 min blind) | Turn-based; pause any time | Fight 3–6 min | High | High | Med-high (card content) | High: race actions as cards |
| **Card race (solitaire drives the horse)** | Pocket Card Jockey: Ride On! (Apple Arcade) | Taps, no time pressure; a race is the frame | Race 3–5 min | High | High | Med | **Perfect**: proven horse + cards |
| **Dice placement** | Dicey Dungeons | Small decisions on few objects | Fight 2–4 min | Med-high | High | Med | **Very high**: dice into training slots |
| **Drafting / auto-battler** | Super Auto Pets (untimed, asynchronous) | Plan, then watch it play out | Round 1–2 min (a full run of 15–25 is too long) | High | High | Med-high (balance) | High: draft support cards |
| **Slot / "landlord" engine** | Luck be a Landlord, Balatro's scoring | One tap per spin; the strategy is in the build | Rent cycle 2–4 min | Med | High | Low-med (DOM) | Medium: fan-festival engine |
| **Tile / merge** | Threes, Triple Town | Swipe or tap, no timer | Open-ended; 3–7 min with a move budget | Med-high | High | **Low** | Medium: forge horseshoes |
| **Puzzle battle / match** | Puzzle & Dragons, Puzzle Quest | Continuous drag, combo skill | Battle 3–5 min | High | High | Built once (Uma Puzzles) | High |
| **Route / positioning puzzle** | Mini Metro, Railbound | Turn-based, readable, no luck | Level 1–3 min, three per stage | Med-high | Med (authored) | Med | **High**: plan a path through rivals |
| **Light tower defense** | Kingdom Rush | Taps to place | Wave set 5–10 min | Med | Med | High (art, balance) | Low |
| **Push-your-luck** | Can't Stop (tabletop), Balatro's discards | One decision: stop or push | Round 20–40 s, 8–10 rounds | Med | High | **Low** | **Very high**: the last spurt against stamina |

**Ranked shortlist (a varied set of 8):**

1. **Card race** (the Pocket Card Jockey model): card play earns lengths and position. Strategy; proven genre.
2. **Winning Live rhythm:** three narrow lanes, tap and hold, two songs a stage. Skill; the franchise's other pillar.
3. **Uma Puzzles, folded in:** a drag-to-match battle against rival Umas ([03](03-racer-today.md) §3).
4. **Racing line:** a top-down track scrolls; one finger holds the rail, slips through gaps, drafts and spurts.
5. **Training dice:** place the week's dice on the five trainings where support cards sit; high faces risk failure.
6. **Find the gap:** a turn-based grid of the final corner. Rivals show their next move; plan lane changes. No luck.
7. **Last spurt:** push-your-luck. Each push gains lengths, a bust means you fade, and stamina buys re-rolls.
8. **Gate & whip:** a timing-bar suite (gate break, claw machine, hurdle). The cheapest, so **build it first** (§5).

Reserves: the slot engine, the runner, the peg board and merge. The eight cover rhythm, dexterity, logic, luck and a
battle with five control verbs.

Sources: [Rhythm Heaven](https://en.wikipedia.org/wiki/Rhythm_Heaven) ·
[Project Sekai](https://en.wikipedia.org/wiki/Hatsune_Miku:_Colorful_Stage!) · [Arcaea](https://en.wikipedia.org/wiki/Arcaea) ·
[Subway Surfers](https://en.wikipedia.org/wiki/Subway_Surfers) · [Alto's Adventure](https://en.wikipedia.org/wiki/Alto%27s_Adventure) ·
[Tiny Wings](https://en.wikipedia.org/wiki/Tiny_Wings) · [Peglin](https://en.wikipedia.org/wiki/Peglin) ·
[Desert Golfing](https://en.wikipedia.org/wiki/Desert_Golfing) · [Golf Story](https://en.wikipedia.org/wiki/Golf_Story) ·
[Slay the Spire](https://en.wikipedia.org/wiki/Slay_the_Spire) · [Balatro mobile (Shacknews)](https://www.shacknews.com/article/141549/balatro-mobile-impressions) ·
[Pocket Card Jockey](https://en.wikipedia.org/wiki/Pocket_Card_Jockey) · [Ride On! review (TouchArcade)](https://toucharcade.com/2023/01/20/pocket-card-jockey-ride-on-apple-arcade-review-controller-features-iphone-ipad-tv-mac) ·
[Dicey Dungeons](https://en.wikipedia.org/wiki/Dicey_Dungeons) · [Super Auto Pets](https://en.wikipedia.org/wiki/Super_Auto_Pets) ·
[SAP basics wiki](https://superautopets.wiki.gg/wiki/The_Basics) · [Luck Be a Landlord](https://en.wikipedia.org/wiki/Luck_Be_a_Landlord) ·
[Landlord design (GamingOnLinux)](https://gamingonlinux.com/2021/03/luck-be-a-landlord-gives-slot-machines-a-little-deck-building-flavour) ·
[Threes](https://en.wikipedia.org/wiki/Threes) · [Triple Town](https://en.wikipedia.org/wiki/Triple_Town) ·
[Puzzle & Dragons](https://en.wikipedia.org/wiki/Puzzle_%26_Dragons) · [Puzzle Quest](https://en.wikipedia.org/wiki/Puzzle_Quest:_Challenge_of_the_Warlords) ·
[Mini Metro](https://en.wikipedia.org/wiki/Mini_Metro_(video_game)) · [Railbound](https://en.wikipedia.org/wiki/Railbound) ·
[Kingdom Rush](https://en.wikipedia.org/wiki/Kingdom_Rush) · [Can't Stop](https://en.wikipedia.org/wiki/Can%27t_Stop_(board_game)) ·
[Uma claw machine (Sportskeeda)](https://www.sportskeeda.com/esports/how-play-claw-machine-minigame-umamusume-pretty-derby)

## 2. Turning performance into progression without timers

**Patterns that work**

- **Grades separate passing from mastery.** Rhythm Heaven's "OK" passes and "Superb" earns a medal. Café ReMix's
  first star clears an order; two more star task sets wait for later.
- **First-clear bounties per character and difficulty.** Hades pays scarce materials once per weapon per Heat level,
  so "clear it once with each" is a goal, not a grind.
- **Sweep once mastered.** Blue Archive unlocks an instant sweep after a manual 3-star clear.
- **Ladders with modifiers.** Heat, Slay the Spire's Ascension and Luck be a Landlord's floors stack rule changes.
- **Assists never block progress** (Celeste's Assist Mode). **Characters change the stage** (Café ReMix's
  recommended Pokémon per stage).

**What not to do:** grind walls, mandatory repetition for core stats, hidden per-run decay (caps are honest), grades
that depend only on luck, failures that pay nothing, unskippable intros, and any daily cap or energy.

**Proposed reward contract**

- A scenario's mini-game has about 10 **rungs** per Uma. A rung is one stage config: difficulty, a track condition
  (Firm, Soft, Heavy, rain, night) as a modifier, and a new rule every third rung. Every fifth is a "G1" remix.
- The stage reports a ratio `p` (score over the rung's target) and up to three bonus tasks. The domain grades it:
  **D** under 0.5 (not cleared), **C** 0.5, **B** 0.75, **A** 1.0, **S** 1.2 or A with every task.
- **Milestone outputs** (stats, aptitude steps, bond levels, skill unlocks) pay on a **high-water mark** per Uma and
  rung: C 0.6, B 0.85, A 1.0 of the rung's table. A better grade pays only the difference, so nothing farms. Tables
  are sized so **every rung at A reaches the Uma's cap** ("completing maxes the Uma"). S adds a one-time **bounty**
  (bond or skill hint), not stats.
- **Run outputs** (skill points, bond points, a roster catch-up material) pay every run: D 0.25, C 0.6, B 0.8, A 1.0,
  S 1.2. Their sinks are capped; overflow becomes the catch-up material.
- **Sweep:** with a best of A or better, an Uma may sweep the rung for run outputs **one grade below her best**; never
  milestones or bounties. **Roster mastery:** once any Uma has S on a rung, every Uma may auto-resolve its milestone at
  B, then play to improve. The 30th Uma doesn't replay 300 stages.
- **Pity:** two Ds in a row offer Assist (slower, wider windows), which caps the grade at B. Practice is free and pays
  nothing.
- **Sims check the bands:** on her tier's rung a competent bot scores A, a novice C, an expert S on about half (§5).

```ts
type Grade = 'D' | 'C' | 'B' | 'A' | 'S'
interface StageReport { stage: StageKind; rung: number; uma: UmaId; p: number; tasks: boolean[]; assisted: boolean }
interface StageAward {
  grade: Grade
  milestone: Partial<Record<MilestoneKind, number>> // delta over this rung's best so far
  run: Partial<Record<RunKind, number>>             // paid every run
  bounty?: BountyId                                 // first S on this rung for this Uma
}
declare function settle(r: StageReport, best: Grade | null, table: RungTable): StageAward
declare function sweep(best: Grade | null, table: RungTable): StageAward | null // null below A
```

If a turn calendar is adopted, a play and a sweep each spend one turn. A retreat banks the partial `p`, so no turn is
ever a total loss.

Sources: [Rhythm Heaven ranks](https://en.wikipedia.org/wiki/Rhythm_Heaven_(video_game)) ·
[Café ReMix orders (Bulbapedia)](https://bulbapedia.bulbagarden.net/wiki/Main_Orders) ·
[Café ReMix spotlight (Smogon)](https://smogon.com/articles/spinoff-spotlight-cafe) ·
[Hades Heat rewards (RPG Site)](https://www.rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards) ·
[Blue Archive sweeps (AppGamer)](https://www.appgamer.com/blue-archive/strategy-guide/total-assault) ·
[New-player guide](https://rentry.org/newbaguide) · [Luck be a Landlord floors](https://www.wikiwand.com/en/articles/Luck_Be_a_Landlord) ·
[Celeste](https://en.wikipedia.org/wiki/Celeste_(video_game)) ·
[What players mean by grinding (Game Developer)](https://www.gamedeveloper.com/game-platforms/what-do-players-really-mean-by-grinding-)

## 3. Mini-game collections done well

| Collection | What it does | Lesson for us |
|---|---|---|
| **WarioWare** | One-word verb prompts. Intro microgames teach each control. Speed-ups and boss stages add difficulty | Every stage's rule fits in **one verb and one sentence**, and its first 20 seconds are the tutorial |
| **Rhythm Heaven** | Optional practice before each game, OK/Superb grades, a Perfect Campaign with limited tries, and a **remix every fifth game** that strings the last four together | A free practice; grades that separate passing from mastery; remix rungs as finales |
| **Mario Party** | Each minigame opens on an instruction screen (rules, controls) with practice from that preview. Controls differ per game | A pre-stage card: verb, a control diagram, the goal, "Try it". Unlike Mario Party, **keep one control vocabulary** |
| **Pokémon Café ReMix** | One gesture across every stage, varied order goals, three star tiers, and a recommended Pokémon per stage | One gesture per game family; varied goals (score, survive, collect, no-miss) instead of score alone; the Uma changes the stage |
| **Umamusume** | The career's claw machine: hold and release, three tries, faster each try, a career mission. *Party Dash*: four minigames, which reviewers found too few; its hidden roguelike was the surprise hit | Short skill games are already on-brand. **Variety and depth per game** matter more than count |
| **Pocket Card Jockey** | A card puzzle drives a horse race | Mapping a non-racing genre onto a race works. Reviewers called it a one-trick pony over time, which argues for a different genre per scenario |

**Control vocabulary** (at most two per game): **tap, hold/release, drag a path, swipe a direction, flick a
vector.** Input in the bottom 60% of the screen, information on top, a left-handed mirror. Difficulty has three
layers: rungs, modifiers, assist.

Sources: [WarioWare](https://en.wikipedia.org/wiki/WarioWare) ·
[How WarioWare nailed minigames (GamesRadar)](https://www.gamesradar.com/warioware-inc-minigame-mania-rnailed-generations) ·
[Rhythm Heaven remixes (Kotaku)](https://kotaku.com/rhythm-heaven-s-remix-stages-are-genius-1712462339) ·
[Iwata Asks: Rhythm Heaven Fever](https://iwataasks.nintendo.com/interviews/wii/rhythmheavenfever/0/1) ·
[Super Mario Party preview (NWR)](https://nintendoworldreport.com/preview/48086) ·
[Mario Party Superstars practice (Twinfinite)](https://twinfinite.net/guides/mario-party-superstars-minigames-how-practice/) ·
[Pokémon Café ReMix](https://en.wikipedia.org/wiki/Pok%C3%A9mon_Caf%C3%A9_ReMix) ·
[Party Dash review (Shacknews)](https://www.shacknews.com/article/141196/umamusume-pretty-derby-party-dash-review) ·
[Party Dash review (Siliconera)](https://siliconera.com/review-umamusume-party-dash-is-tons-of-fun-in-short-bursts) ·
[Ride On! review (VGC)](https://www.videogameschronicle.com/review/review-pocket-card-jockey-ride-on-ensures-game-freaks-cult-favourite-wont-go-to-pasture)

## 4. Tech for an iPhone PWA

**Measured here** (the current `apps/web/dist`, gzip): uma-kit's Hub chunk with Phaser 4.2.1 is about **374 KB**;
the race scene with tree-shaken PixiJS 8 is about **90 KB**. Phaser is precached by the service worker and is already
loaded whenever the player comes from the Hub.

| Stage type | Engine | Why |
|---|---|---|
| Turn-based: cards, dice, drafting, slots, push-your-luck, the gap puzzle | **DOM + CSS + Motion** | Crisp text, VoiceOver, 44 pt targets, kit primitives, and no render loop when idle (battery) |
| Real-time: timing bar, rhythm, racing line, runner, catch, the puzzle drag | **Phaser 4** | Already precached (zero extra bytes). Scenes, pointer input, tweens, particles, audio unlock with a shared `AudioContext` (`audio.context`), a loop that pauses on `hidden`, context restoration in 4.0's renderer, and agent skill files in the npm package (`skills/`) |
| The race scene | PixiJS 8 (unchanged) | No new Pixi scenes |

**Recommendation: DOM for turn-based stages, Phaser 4 for real-time ones, PixiJS only in the race scene, and no
third engine.** If the old puzzle view returns, port its 370-line Pixi scene to Phaser. The "no uma-racer module
imports Phaser" hand check becomes "Phaser only under `stages/*/scene`" (a decision). Rollup should share one `phaser`
chunk with the kit's Hub; confirm it in the first build.

**iOS specifics**

- **Input:** Pointer Events with `setPointerCapture`, `touch-action: none` on the play surface (Phaser's
  `input.touch.capture` defaults on), one page so edge swipes have nowhere to go. Timestamp with `event.timeStamp`,
  quantise to the sim tick, never judge below one frame (8–17 ms). Windows **(guess, tune on device)**: Perfect
  ±45 ms, Good ±90 ms, plus a per-device tap-along offset.
- **60/120 Hz:** 60 unless the owner flips Safari's flag. A fixed-tick sim gives the same result either way.
- **Audio:** one shared `AudioContext`, unlocked on the first tap. Rhythm schedules on `currentTime` with look-ahead
  ("two clocks") and subtracts `outputLatency` where reported (verify in Safari). `navigator.audioSession.type`
  decides whether the silent switch mutes the game. Every audio cue has a visual twin.
- **Haptics:** none in practice since iOS 26.5 closed the scripted `<input switch>` trick.
- **Wake lock** during real-time stages (Safari 18.4+; `RunPage` already does it).
- **Memory:** one WebGL context at a time (the Hub's game dies on unmount), DPR ≤ 2, no canvas resizes (WebKit leak
  reports), atlases ≤ 2048² per game. Shared canvas limit of 256 MB **(guess, one developer's report)**.
- **Context loss and kills:** rebuild textures on `webglcontextrestored`, test with `WEBGL_lose_context`, and trust
  the journal (§5), not the GPU.
- **Battery:** real-time stages render only while running; turn-based ones run no loop; pause on `hidden`.
- **Lazy loading:** a registry `load: () => import('./stages/<kind>')` keeps each game out of the 180 KB startup check.
  Budget about 60 KB gzip a game, excluding Phaser. The service worker precaches chunks up to 3 MB, so stages work
  offline.

Sources: [game-web-tech.md](../game-web-tech.md) · [architecture budgets](../../game/architecture.md#budgets-and-checks) ·
[Phaser v4.0.0 release](https://github.com/phaserjs/phaser/releases/tag/v4.0.0) ·
[Phaser 4 default build ≈ 310 KB gzip](https://tech-insider.org/phaser-4-tutorial-browser-game-12-steps-2026/) ·
[Slimmed Phaser build (PR)](https://github.com/ch-leon/nrl-sim/pull/406) ·
[iPhone PWA game guide (gist)](https://gist.github.com/fozzedout/5e77925381991a9570151550992baf14) ·
[iOS PWA compatibility (firt.dev)](https://firt.dev/notes/pwa-ios/) · [Touch and pointer events (Lauke)](https://patrickhlauke.github.io/getting-touchy-presentation/) ·
[A tale of two clocks (web.dev)](https://web.dev/articles/audio-scheduling) ·
[outputLatency (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency) ·
[AudioSession.type (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type) ·
[ios-haptics](https://github.com/tijnjh/ios-haptics) ·
[WebGL context loss (bugnet)](https://bugnet.io/blog/fix-webgl-context-lost-on-tab-switch-restoration) ·
[iOS context loss (three.js forum)](https://discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772)

## 5. A mini-game framework

The race already has this shape: pure rules in the domain, a seeded RNG (`createRng`, mulberry32, integer-only), a
fixed tick, and a view that only plays the result back. Each mini-game splits the same way:

```ts
// packages/domain/src/stages/<kind>/ : pure, runs in Node for tests and sims
interface StageConfig { kind: StageKind; rung: number; seed: number; uma: UmaProfile; modifiers: ModifierId[]; assist: boolean }
type StageInput = { tick: number; code: number; x?: number; y?: number } // quantised; tick = move index if turn-based
interface StageRules<S> {
  kind: StageKind; version: number              // bump on any rule change; old journals replay on their version
  tickHz: 0 | 30 | 60                          // 0 = turn-based
  init(c: StageConfig): S
  step(s: S, inputs: readonly StageInput[]): S  // one tick or one move; pure, seeded RNG inside S
  done(s: S): boolean
  report(s: S): { p: number; tasks: boolean[] } // §2 grades it
  bots: Record<'novice' | 'competent' | 'expert', (s: S, rng: Rng) => StageInput[]>
}
interface Journal { config: StageConfig; version: number; inputs: StageInput[]; atTick: number } // Dexie, flushed on pause

// apps/web/src/stages/<kind>/ : lazy view
interface StageView {
  mount(host: HTMLElement, ctx: {
    rules: StageRules<unknown>; journal: Journal; reducedMotion: boolean; audio: SharedAudio
    onInput(i: StageInput): void; onDone(): void
  }): { pause(): void; resume(): void; destroy(): void }
}
```

- **The domain settles, not the view.** On `done` the host replays `journal.inputs` through `rules` and calls §2's
  `settle`; sims and tests run the same code. The point is honest balance and bug repro, not anti-cheat.
- **Determinism:** integers, fixed-point or `+ − × ÷ √` only. `Math.sin`, `Math.pow` and kin can differ between
  JavaScriptCore and V8, so use tables. Sim physics is our own small solver, never Phaser's Arcade or Matter
  (cosmetics only). Wall-clock time never enters the sim.
- **Pause and resume:** `visibilitychange`/`pagehide` pause and flush the journal. After a kill, the host replays to
  `atTick` and resumes after a 3-2-1, real-time stages included.
- **Reduced motion:** motion that carries rules stays; shake, parallax and particles go. Colour never carries a rule
  alone (D184's ring and glyph).
- **Balance:** `pnpm sim:stages --kind=<k>` runs the three bots over every rung and modifier and fails when §2's
  bands miss ([the balance sims](../../game/architecture.md#the-balance-sims)).
- **Adding a mini-game:** rules, bots and a golden journal-hash test; a registry row (kind, version, rungs, output
  tables, `load()`); the view, guide card and practice; the sim; its manual page.

Sources: [Replay verification pitfalls (bugnet)](https://bugnet.io/blog/how-to-fix-replay-verification-failing-from-nondeterministic-simulation) ·
[Math.pow differences (Mozilla bug)](https://bugzilla.mozilla.org/show_bug.cgi?id=1775254) ·
[V8 exponent bug (freeCodeCamp)](https://www.freecodecamp.org/news/i-found-a-bug-in-v8s-exponentiation-operator-dcddfa5b8482/) ·
[Seed and tick replays (Crimsonland CLI)](https://www.mintlify.com/banteg/crimson/cli/replay/overview)

## Open points for the owner

1. **Which eight?** My recommendation is the §1 shortlist, with the timing-bar suite built first as the framework's
   proof. Recommended default: accept it.
2. **In-stage clocks.** A countdown inside a stage (rhythm, the old puzzle's 7-second drag) is skill timing, not a
   wall-clock mechanic. Recommended: allow it.
3. **Attempts in a calendar.** Recommended: one attempt per turn, with a retreat that banks partial credit, and free
   practice outside the calendar. The alternative is free retries before banking, which removes the tension.
4. **Roster mastery at B.** Once any Uma has an S on a rung, every Uma may auto-resolve its milestone at B. Generous,
   but it matters with hundreds of outfits. Grade C is the stricter option.
5. **Engine policy.** DOM for turn-based stages and Phaser for real-time ones, which changes the Phaser hand check.
   This needs a decision entry.
6. **Rhythm audio.** Original Uma songs are private content (like art). Use them, or original tracks with generated
   charts?
