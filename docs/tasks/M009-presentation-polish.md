# Milestone 9 — Presentation polish

**Outcome:** the game looks and sounds finished on the owner's iPhone: original iconography instead of emoji, sound and
motion that agree with each other, one feedback language across every reward, and measured performance and accessibility
on the physical device.

This is the polish milestone from the original roadmap. It was drafted as Milestone 7; alignment and stability took that
slot instead (D105), and the release-readiness part of the draft became
[T022](T022-release-and-update-readiness.md). Everything below is deliberately *presentation*: it consumes committed
facts and never becomes a second rules engine.

## Baseline

The app already has the Racecourse Pop palette and type, chunky press feedback, safe-area utilities, reduced-motion
paths, deterministic race pre-roll and photo finish, result confetti, collection reveals, PWA icons, and private-content
caching. What is missing: original iconography (emoji still carry navigation, currencies, stats, and states), any audio
at all, the designed Settings controls, one consistent celebration hierarchy, and physical-device measurement.

## Task outline

| Task | Scope |
|---|---|
| T030 | Original icon set and visual-state closure: one SVG system with accessible names, replacing every emoji and placeholder; states use shape and text, not only color |
| T031 | Audio and device preferences: one lazy `AudioContext`, a pooled cue catalog, master/SFX/music volume, reduced-motion override, race speed, honest haptic capability |
| T032 | Coordinated feedback: one deterministic presentation queue with ordinary/useful/major/exceptional intensities, completed Training, race, results, collection, scenario, and flair sequences, shared-element transitions |
| T033 | Physical-iPhone acceptance: close the device backlog in [open-questions.md](../open-questions.md), the lifecycle matrix, measured budgets, the hidden diagnostics panel, and a VoiceOver/Dynamic Type audit |
| T034 | Optional: night theme, richer original badge art, higher-resolution portrait art only with a documented private source |

## Fixed rules

- Licensing: project-owned or properly licensed icons and audio only. Original-game audio and UI art are prohibited;
  original character and card imagery stays in the private authenticated atlases, and 128 px icons are never upscaled
  into fake portrait art.
- Polish never changes caps, costs, curves, coefficients, rewards, simulation outcomes, or persistence truth.
- Cues derive from committed action, result, and event identities. Retry, reload, replay, and history views never
  fabricate freshness or replay a one-time celebration.
- Skip and reduced motion produce the same facts immediately; presentation delays never hold a commit.
- Reduced motion, muted, offline, unsupported haptics, and missing content are first-class outcomes, not edge cases.
- Keep `m.*` under `LazyMotion strict`, animate only transform and opacity in the DOM, keep Pixi, Firebase, and audio
  lazy, and stay inside the 180 KB gzip startup budget. No new dependency without a recorded bundle cost.
- Audio never advances state, gates a commit, or owns cue timing, and every sound has a visual equivalent.

## Definition of done

- No primary surface uses an emoji or a placeholder as final UI.
- Sound, music, motion, and race-speed controls work, and unavailable haptics are represented honestly.
- Every major progression moment has coordinated, skippable, reload-safe feedback.
- All device checks from Milestones 3–6 are closed with defects fixed, not merely recorded.
- Sustained 60 fps (120 where the device allows), tap-to-response under 100 ms, warm start under 1.5 s, GPU texture
  memory under 150 MB, measured on the owner's iPhone with Safari Web Inspector.
- `pnpm lint`, `pnpm test`, and `pnpm build` pass, and no private content or secret is tracked.

## Not in this milestone

Friend/Group gameplay and scenario modifiers (Milestone 8), R4 race drama, new badge criteria, economy or balance
changes, and anything social: sharing, leaderboards, global rarity, or server-authoritative play.
