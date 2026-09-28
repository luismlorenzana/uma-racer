# Milestone 11 — Game feel and device readiness

**Outcome:** the game sounds and responds like a finished product on the owner's iPhone, and its performance and
accessibility are measured rather than assumed.

This is what remains of the original polish plan after the look (Milestone 9, the [Paddock visual system](../design/visual-system.md)) and the collection
([Milestone 10](M010-collection-depth.md)) were pulled out as milestones of their own. It consumes committed facts and
never becomes a second rules engine.

## Task outline

Specs get written when each task becomes next.

| Task | Scope |
|---|---|
| T036 | **Audio and device preferences:** one lazy `AudioContext`, a pooled cue catalogue (taps, training, race, progression, collection, flair), master/SFX/music volume, reduced-motion override, default race speed, honest haptic capability |
| T037 | **Coordinated feedback:** one deterministic presentation queue with ordinary/useful/major/exceptional intensities; complete Training, race, results, collection, scenario and flair sequences; shared-element transitions |
| T038 | **Physical-iPhone acceptance:** close the device backlog in [open-questions.md](../open-questions.md), the lifecycle matrix, measured budgets, the hidden diagnostics panel, and a VoiceOver and Dynamic Type audit. It includes Spark Rival Circuit's physical-device protocol and 30-second trace budget (D189), written out in `git show 7129d77:docs/tasks/T074-spark-rival-polish.md` |
| T039 | **Optional:** night theme from the existing tokens, bespoke badge and trophy illustrations, higher-resolution portrait art only with a documented private source |

## Fixed rules

- Licensing: project-owned or properly licensed audio and art only. Original-game audio and UI art are prohibited;
  original character and card imagery stays in the private authenticated atlases, and 128 px icons are never upscaled
  into fake portrait art.
- Feel work never changes caps, costs, curves, coefficients, rewards, simulation outcomes or persistence truth.
- Cues derive from committed action, result and event identities. Retry, reload, replay and history views never
  fabricate freshness or replay a one-time celebration.
- Skip and reduced motion produce the same facts immediately; presentation delays never hold a commit.
- Audio never advances state, gates a commit or owns cue timing, and every sound has a visual equivalent.
- Muted, offline, reduced-motion, unsupported-haptics and missing-content paths are first-class outcomes.
- Keep `m.*` under `LazyMotion strict`, animate transform and opacity only in the DOM, keep PixiJS, Firebase and audio
  lazy, and stay inside the 180 KB gzip startup budget.

## Definition of done

- Sound, music, motion and race-speed controls work, and unavailable haptics are represented honestly.
- Every major progression moment has coordinated, skippable, reload-safe feedback.
- All device checks from Milestones 3–6 are closed with defects fixed, not merely recorded.
- Sustained 60 fps (120 where the device allows), tap-to-response under 100 ms, warm start under 1.5 s, GPU texture
  memory under 150 MB, measured on the owner's iPhone with Safari Web Inspector.
- `pnpm lint`, `pnpm test` and `pnpm build` pass, and no private content or secret is tracked.

## Not in this milestone

Gameplay of any kind, R4 race drama, new badge criteria, economy or balance changes, and anything social: sharing,
leaderboards, global rarity or server-authoritative play.
