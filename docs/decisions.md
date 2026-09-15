# Decisions Log

Newest entries at the bottom. Each entry records **what** was decided, **why**, and the **date**.
To reverse a decision, add a new entry that supersedes it instead of editing history.

| # | Date | Decision | Why / Notes |
|---|---|---|---|
| D1 | 2026-09-14 | Personal use only, never distributed. Original game assets stay local-only | Uses third-party IP |
| D2 | 2026-09-14 | **Build the racing sim first**, then layer training and progression on top | Races are the payoff, and training only produces inputs for races |
| D3 | 2026-09-14 | Runs as a **web app / PWA** on the phone | Fastest iteration, works on any device, easy use of images and icons. *Pending the user's technical input* |
| D4 | 2026-09-14 | Races are shown on a **2D straight-line track in real time** with character icons | Simple assets, clear readability |
| D5 | 2026-09-14 | Umas have a **permanent level**, with no per-run instances | An RPG-style long-term attachment |
| D6 | 2026-09-14 | **Every 10 levels = one scenario tier**, in JP release order, with scenario-specific stat caps | Gives progression the shape of the game's history |
| D7 | 2026-09-14 | **Race wins grant Uma EXP.** Gate levels (10, 20, …) require promotion | Racing drives leveling |
| D8 | 2026-09-14 | Training uses the Uma's base stats and growth rates, plus equipped cards and their levels, **clamped to scenario caps** | |
| D9 | 2026-09-14 | Cards are available **by original release era**: the current scenario's era and all earlier ones | |
| D10 | 2026-09-14 | Cards **level through use**. **Every 5 levels is one limit break**, and advancing needs promotion | Replaces gacha duplicates |
| D11 | 2026-09-14 | Training formulas are **simplified**, and newer cards are straightforwardly stronger | Balance stays readable, with no need to copy the original's RNG |
| D12 | 2026-09-14 | A **daily login resource** pays for Uma scenario promotions and card limit breaks | |
| D13 | 2026-09-14 | **Badges and achievements are a core pillar**, with lots of per-Uma flair split by aptitude, distance, surface, and more | |
| D14 | 2026-09-14 | **Soft limit on training: 6 training turns per level-up**, carried over when unused | Racing unlocks training, and cards matter without hard walls |
| D15 | 2026-09-14 | **SSR support cards only.** No R or SR cards exist in the game | |
| D16 | 2026-09-14 | **Cards are collectible.** The starter set is every SSR card that was free or an event reward in the original game | Exact list still to research |
| D17 | 2026-09-14 | Maxing a card (LB4 and max level) grants a **Card Select Coupon** for any card. Coupons stack and never expire | |
| D18 | 2026-09-14 | **Umas are unlockable with coupons**: 1 Uma Shard each time an Uma reaches a 10-level milestone, and 5 shards make 1 Uma Select Coupon. Stackable, never expire | About 1 coupon per 50 levels |
| D19 | 2026-09-14 | **Inheritance**: a parent Uma passes a **weaker version of her unique skill** plus **white versions of her skills** | Details and open points in skills-and-inheritance.md |
| D20 | 2026-09-14 | **Skill points** are trained like a stat (cards give SP like other stats), with an **SP cap that rises each scenario** | |
| D21 | 2026-09-14 | Each Uma can **fine-tune her equipped skills** from what card training and inheritance gave her | |
| D22 | 2026-09-14 | **Collection is a core pillar**: Uma, card, and badge collections, plus account achievements that aggregate per-Uma data (total wins, total stat badges…) | |
| D23 | 2026-09-14 | **Scenario goals** per Uma, based on aptitudes and real-horse identity (Long → Arima Kinen, Medium or male → Triple Crown, female → Triple Tiara…) | |
| D24 | 2026-09-14 | **Race Form difficulty**: your Uma and the field both start at an 80% race-stat nerf. Each level removes 2% for your Uma and 1% for the field, so your Umas slowly outgrow opponents who are at their level | |
| D25 | 2026-09-14 | **Race Form resets at each scenario** (80/80 at level X1, 98/89 at level X0) | Otherwise the edge disappears after level 21 |
| D26 | 2026-09-14 | **SP is loadout capacity**: equipped skill costs must be ≤ current SP. Never spent, freely swappable | |
| D27 | 2026-09-14 | **Scenario goals are optional but very visible** (Journey strip, ribbons, Honors crests, fanfare) | |
| D28 | 2026-09-14 | **Gold skills come only from cards.** Parents pass **only white skills**, and a gold passes down as its white version | Matches the original game |
| D29 | 2026-09-14 | **Family tree: 2 parents, each bringing their own 2 parents as grandparents** | Like the original game |
| D30 | 2026-09-14 | **Parent snapshots**: each Uma's latest parent lineup is saved when she starts a scenario. Parents are picked per scenario from the latest snapshot of each Uma | Frozen copies one level down make circular lineups (Kitasan ↔ Suzuka) resolvable |
| D31 | 2026-09-14 | Parents **automatically** pass their unique (weaker) and all inheritable whites. From grandparents, **pick 2 of up to 4 uniques** and **up to half of their white pool**, from any grandparent | |
| D32 | 2026-09-14 | **Umas can train without parents** (0, 1, or 2 parents allowed) | Makes the first trainings possible |
| D33 | 2026-09-14 | **Starter roster: all 25 original launch trainees** (9 three-star, 8 two-star, 8 one-star) | Supersedes the earlier "about 8" idea |
| D34 | 2026-09-14 | **Only direct skills pass down**: an Uma's own unique and her card-learned skills. Inherited skills never pass down again | Keeps the grandparent caps meaningful, and keeps card hints valuable |
| D35 | 2026-09-14 | **Parent snapshots are fully frozen** (the Uma plus her parents, as of that moment). Taken at scenario completion. To refresh a parent, retrain her | Supersedes D30's "saved at scenario start" timing |
| D36 | 2026-09-14 | **Every Uma uses her 5★ base stats** from the original game, with Race Form nerfs on top | Original rarity doesn't make an Uma permanently weaker |
| D37 | 2026-09-14 | **The skill library refreshes per Uma per scenario.** Only her own unique (plus unlocked awakening skills) carries over, and the rest is re-earned through that scenario's inheritance and card training | The loadout always reflects the latest training and parents |
| D38 | 2026-09-14 | **Each new scenario opens with training**: the first race unlocks after 6 training turns in that scenario | "Retrain first, then race" |
| D39 | 2026-09-14 | **Awakening skills are kept**: 4 permanent skills unlocked by early scenario completions, kept through skill refreshes | |
| D40 | 2026-09-14 | **Opening training is 1 turn**: a single training in a new scenario unlocks racing. More training is optional | Supersedes D38's 6 turns |
| D41 | 2026-09-14 | **Split Uma Level and Training Level.** Uma Level is permanent, earned only from racing, and sets scenario gates and Race Form. Training Level (1–10) resets each scenario, is earned only from training, and sets the stat and SP caps: the scenario baseline × 80% at TL1, rising with TL | Supersedes D14's 6 turns per level. Training rework |
| D42 | 2026-09-14 | **Training gives Training EXP and card EXP. Racing gives only Uma EXP.** Card level decides how much each equipped card contributes | |
| D43 | 2026-09-14 | **Training is unlimited in principle, paced by daily Training Tickets**: 1 per training turn, +50 per day, stored up to 500 (or unlimited, TBD) | |
| D44 | 2026-09-14 | **The Training Level cap reaches 100% of the scenario baseline at TL10** (80% at TL1) | |
| D45 | 2026-09-14 | **Ticket storage is capped at 500.** Tickets accrue while you're away | Resolves D43's TBD |
| D46 | 2026-09-14 | **At most 25 trainings to reach TL10** (36 Training EXP per training, 100 per TL, friendship ×1.5). Base facility gains tripled, and per-tier gain scaling removed | Stats carry over, so later tiers only need deltas |
| D47 | 2026-09-14 | **Uma Level and Training Level are independent.** TL gates nothing except caps | |
| D48 | 2026-09-14 | **Trained stats carry over between scenarios.** Caps limit gains and never reduce stats. Only Training Level and the skill library reset | Fits "keep training only if I need better stats" |
| D49 | 2026-09-14 | **Close every open question**: the remaining items take Claude's recommendations or defaults (D50–D58). Every earlier *(proposed)* item is adopted as the baseline design, and numbers stay tunable drafts | User request: no open questions |
| D50 | 2026-09-14 | Progression: gate-level EXP overflow is **banked up to one level's worth** · **2nd–3rd place get 25%** of win EXP · **one template per outfit** (badges also roll up per character) · **promotion bonus of +10 to each stat** | Defaults per D49 |
| D51 | 2026-09-14 | Aptitudes improve **only via parent pink sparks**: +1 grade per parent per scenario, picked from the parent's A/S aptitudes, capped at A. **No blue (stat) sparks** | Defaults per D49 |
| D52 | 2026-09-14 | Inheritance details: the inherited unique is **×0.5 for parents and grandparents alike** · grandparent "half" uses **ceil** · a duplicate grandparent uses the **most recent frozen copy** | Defaults per D49 |
| D53 | 2026-09-14 | Goals count **only within their scenario**, and missed goals stay as hollow pips · **3 Card Select Coupons at the start** · coupons can pick **any card or Uma, including future eras** | Defaults per D49 |
| D54 | 2026-09-14 | Cards: **levels shared across Umas** · **25 levels, LB0–LB4 at 5 each** · **effect profiles and hint skills seeded from the original data**, values generated · **Friend/Group cards after the MVP** · deck slots **4 / 5 / 6** in tiers 1 / 2 / 3+ · LB unlocks as listed in support-cards.md | Defaults per D49 |
| D55 | 2026-09-14 | Scenarios: **JP timeline** · **every JP scenario after #11 is included** (baseline caps +200 each) · **every scenario gets its modifier after the MVP**, in release order | Defaults per D49 |
| D56 | 2026-09-14 | Racing: **grades unlock by tier** (G1 from tier 4) · **rival Umas after the MVP** (up to 2 of your own Umas in a field) · **titles can be earned anytime** | Defaults per D49 |
| D57 | 2026-09-14 | Economy: **Carrots 🥕 is one resource** for Umas and cards · missed days: **the streak pauses**, and unclaimed 🥕 **pile up for 7 days** · **badges, achievements, goals, and completions pay 🥕** | Defaults per D49 |
| D58 | 2026-09-14 | Badges: **6 pinned badges** · **Prestige frames kept** · Speedrun variant = **promoted within 15 races** | Defaults per D49 |
| D59 | 2026-09-14 | **Coupons stay split by path**: leveling Umas earns Uma Shards and Uma Select Coupons (more Umas), and maxing cards earns Card Select Coupons (more cards) | Clarifies D17/D18 |
| D60 | 2026-09-14 | **Every race grade, G1 included, is open from scenario 1.** Difficulty comes from the grade's field strength | Supersedes D56's tier-gated grades |
| D61 | 2026-09-14 | **Baseline enemy Uma**: opponents are drawn at random from every Uma in the game, all with identical generic stats (scenario baseline cap × grade factor × distance profile × field Form), A aptitudes, their best strategy, a shared 4-white-skill kit, and their own unique | NPC feel, and every Uma is viable as an enemy. Replaces fill(k) opponents |
| D62 | 2026-09-14 | **Rival Umas dropped** | Conflicts with the generic enemy setup. Supersedes D56's rivals |
| D63 | 2026-09-14 | **Carrots removed. Training Tickets are the only currency**, spent on training (1), Uma promotions (25 × tier), and card limit breaks (20 × LB) | Supersedes D12 and D57 |
| D64 | 2026-09-14 | **Tickets come only from** the daily +50, Uma Level-ups (+5), and card level-ups (+2). **No streaks**, and badges, achievements, and goals don't pay currency. The 500 cap only limits the daily grant | |
| D65 | 2026-09-14 | **Big Badge page** with Uma, Stable, and Trainer scopes: **unlimited pins** with drag ordering, showcase groups, multi-select, tag-based classification, filters, sorting, search, and saved views. The profile card shows the first 12 pins | Supersedes D58's 6 pinned badges |
| D66 | 2026-09-14 | **Reuse the uma-planner architecture**: pnpm/Turbo monorepo, React SPA on Firebase Hosting, NestJS API on Cloud Run, Firebase Auth with an owner allowlist, Firestore, keyless GitHub Actions deploys. Current major lines: React 19, Vite 7, React Router 7, Tailwind 4, NestJS 11, TypeScript 5.9 | User request. Majors chosen for known APIs, not the newest possible |
| D67 | 2026-09-14 | **A new GCP/Firebase project `uma-racer`** on the same billing account. Target cost about $0 a month, with budget alerts at $1 and $5 | Its own free tiers and isolation from uma-planner |
| D68 | 2026-09-14 | **Local-first game state**: IndexedDB (Dexie) plus a Zustand store, with an outbox synced to Firestore through the API | The game never waits on the network or Cloud Run cold starts |
| D69 | 2026-09-14 | **Races are simulated on the device, up front and deterministically** (seeded, 15 Hz), then played back with interpolation | Free skip, replay, and batch balancing |
| D70 | 2026-09-14 | **Rendering: DOM + Motion for UI, PixiJS 8 for the race and effect scenes** (WebGL by default, WebGPU as a dev toggle) | Research in game-web-tech.md |
| D71 | 2026-09-14 | **Content pipeline**: GameTora datasets and images → private content packs and WebP atlases in a private GCS bucket, served through the authenticated API and cached by the service worker. Never in git or the Hosting bundle | Keeps original-game content private. Reuses uma-planner's importer approach |
| D72 | 2026-09-14 | **Home Screen web app on iPhone, portrait first** (landscape allowed on the race screen), delta-time animation. Turning on Safari's 120 Hz flag is recommended on the owner's device | |
| D73 | 2026-09-14 | **Haptics are progressive enhancement only**. Motion plus sound carry all feedback | The iOS switch-input haptics trick was patched in iOS 26.5 |
| D74 | 2026-09-14 | **UX shell**: bottom tabs (Home · Stable · Race · Cards · Badges), bottom sheets for pickers, full-screen scenes for Training, Race, Results, and reveals. "Racecourse Pop" visual style with M PLUS Rounded 1c | See ux.md |
| D75 | 2026-09-14 | **The deploy job is gated by the repository variable `DEPLOY_ENABLED`** until the GCP bootstrap is done | CI stays green before infra exists |
| D76 | 2026-09-15 | **Stat caps follow the original game's ladder**: baseline 1200 at tier 1, +80 per scenario to 2000 at tier 11, +80 after that. **No race stat multiplier** | The earlier 600 → 2000 caps were invented drafts at about half the original's scale, and starved races of stamina. Supersedes the draft caps in D6 |
| D77 | 2026-09-15 | **Original soft cap**: the part of a stat above 1200 counts half in races and gains half from training (skill points excluded) | Matches the original game |
| D78 | 2026-09-15 | Training gains **doubled** (facility base gains and card Stat Bonus) to fit the 1200-scale caps. Stat badge thresholds rescaled to 600 / 900 / 1200 / 1600 / 2000 | Keeps "about 25–30 trainings to cap" in tier 1 |
| D79 | 2026-09-15 | **GitHub repo `luismlorenzana/uma-racer` (private) is live, and Claude pushes to `main`**. GCP project settings are read from repository variables, so the setup works even if the `uma-racer` project ID is taken | The owner created the repo and asked Claude to do as much of the deployment as possible |
