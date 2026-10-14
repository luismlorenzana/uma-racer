# Game-like Web Tech on iPhone

Research for building a game that **feels native** as a Home Screen web app on iPhone.
Researched 2026-09-14. ✅ = confirmed from a source during research. 📘 = established platform knowledge; re-check if something misbehaves.

## Rendering

| Option | Verdict |
|---|---|
| DOM + CSS | **Menus, lists, sheets, HUD.** Accessible, crisp text, cheap when only `transform`/`opacity` animate |
| Canvas 2D | Workable for a simple track, but no batching, filters, or cheap particles |
| **PixiJS 8 (WebGL, optional WebGPU)** | **Race scene and effect overlays.** A batched 2D renderer made for sprites and particles, with a small API |
| Phaser 4 | A full game framework (scenes, physics, input). More than we need next to React |
| Three.js | 3D. Not needed |

Findings:

- **PixiJS 8** is actively maintained. Recent releases (8.16+) added an experimental Canvas fallback renderer and tagged text ✅.
  Its WebGPU backend isn't automatically faster, since Pixi is usually CPU-bound. WebGPU helps mostly in scenes with many batch breaks (filters, masks, blend modes) ✅.
- **WebGPU is on by default since Safari 26** (iOS 26) ✅.
  **Decision:** use Pixi's WebGL renderer by default (widest support, mature), and expose WebGPU as a dev setting to benchmark on-device.
- **@pixi/react v8 requires React 19** ✅. We still create the Pixi `Application` **imperatively** inside a React component for the race scene,
  so the render loop never goes through React reconciliation.
- **GameTora images send `Access-Control-Allow-Origin: *`** (checked 2026-09-14), so they are usable as WebGL textures. We still copy them into
  our own atlases (see [Architecture — Content](../technical/architecture.md#3-content-reference-data-and-images)) for performance and resilience.

## Frame rate on iPhone

- Safari renders at **60 fps by default**, even on ProMotion displays ✅.
- Since Safari 26.3 you can unlock 120 Hz by turning off **"Prefer Page Rendering Updates near 60fps"** in Settings → Apps → Safari → Advanced → Feature Flags ✅.
  It's a per-device user setting, and worth doing on the owner's iPhone.
- **Design rule:** every animation and interpolation uses **elapsed time (delta)**, never frame counts, so the game is correct at 60 and smoother at 120.
- The race sim runs at a **fixed 15 Hz tick**, independent of the display. The renderer interpolates.

## Animation stack

| Need | Choice | Why |
|---|---|---|
| UI transitions, press states, sheets, layout and shared-element animation | **Motion** (`motion/react`) | React-first, tree-shakable, springs, gestures, layout animations. MIT ✅ |
| Canvas scenes (race, particles, fanfare effects) | **Pixi ticker + small in-house tweens** | Stays in the render loop, no DOM |
| Complex scrubbed timelines | GSAP (now free) ✅ | **Not adopted yet.** Add only if a specific sequence needs it |
| Page-to-page transitions | View Transitions API (same-document, Safari 18+) 📘 | Optional polish. Motion covers it otherwise |

Rule of thumb: most React projects start with Motion and add GSAP only for heavy timelines ✅.

## Home Screen web app (PWA) on iOS

| Capability | Status on iOS | Use in Uma Racer |
|---|---|---|
| Standalone launch | Since iOS 26, every site added to the Home Screen opens as a web app ✅. With a manifest we control name, icons, colors, `display: standalone` | ✅ Main way to play |
| Offline | Service worker with Cache Storage 📘 | ✅ App shell, content packs, fonts |
| Storage | IndexedDB. Policies improved in Safari 17, but quotas are tighter than Chrome ✅. Home Screen apps aren't subject to Safari's 7-day eviction of script-written storage 📘 | ✅ Save lives in IndexedDB and is **backed up to Firestore by sync** |
| Push notifications | Since iOS 16.4, Home Screen apps only. Declarative Web Push since Safari 18.4 ✅ | Later: an optional "tickets are full" reminder |
| Screen Wake Lock | Safari 18.4+ ✅ | ✅ Keep the screen on during a race or long training session |
| Background sync | Not reliable on iOS ✅ | Sync on foreground, visibility change, and after actions |
| Haptics | No Vibration API. The `<input type="checkbox" switch>` label-click trick worked on iOS 17.4–26.4, but **Apple patched it in iOS 26.5** ✅ | Progressive enhancement only. **Sound plus visuals carry the feedback** |
| Audio | Web Audio needs a user gesture to start (unlock on first tap). The hardware silent switch may mute it 📘 | ✅ One shared `AudioContext`, unlocked on the first tap. Short SFX sprites |

## iOS Safari layout and touch checklist 📘

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, then pad with `env(safe-area-inset-*)` for the notch, Dynamic Island, and home indicator.
- Size full-screen scenes with `100dvh` / `100svh`, never `100vh`.
- `touch-action: manipulation` on interactive elements, so double-tap doesn't zoom.
- `overscroll-behavior: none` on html/body and scroll containers, so scenes don't rubber-band or pull-to-refresh.
- `-webkit-tap-highlight-color: transparent`, plus `-webkit-touch-callout: none` and `user-select: none` on game surfaces (keep text selectable in docs-like views).
- Inputs at 16 px or larger, so focusing them doesn't auto-zoom.
- `apple-mobile-web-app-title`, `apple-touch-icon` (180×180), `theme-color`, and a manifest with `display: standalone`.
- Prefer **Pointer Events** for game input. Mark passive listeners, and call `preventDefault` only on the canvas.

## Performance playbook

**Budgets**

| Metric | Budget |
|---|---|
| Sustained frame rate in race and training scenes | 60 fps (120 fps with the flag), no long frames over 50 ms |
| Tap → visual response | < 100 ms (instant press state, then the result) |
| Initial JS (app shell, gzip) | ≤ 180 KB. PixiJS and scenes lazy-loaded. Enforced by `scripts/check-size.mjs` in the web build since D337 (155.10 KB on 2026-10-14) |
| Warm start from the Home Screen | < 1.5 s to interactive (everything served from cache and IndexedDB) |
| GPU textures in memory | < 150 MB, atlases ≤ 4096² |

**Techniques**

- Animate only `transform` and `opacity` in the DOM. Use `will-change` sparingly, on the element about to animate.
- Virtualize long grids (Badge page, Card album, Stable) and use `content-visibility: auto` for off-screen sections.
- Pack race icons into **sprite atlases**, one draw call for the whole field. Size textures for DPR 3 but no larger than displayed.
- **Pool objects** (particles, popups) in Pixi scenes, so they don't allocate every frame.
- Keep game state in Zustand with fine-grained selectors, so a stat tick re-renders only its meter.
- Compute races and badge re-evaluation off the main thread (Web Worker) once batch sizes need it. A single race is fast enough on the main thread.
- Pause Pixi tickers and audio when `document.hidden` (battery, and the iOS background freeze).
- Self-host fonts (WOFF2, subset, `font-display: swap`) so they work offline and don't shift layout.

## Profiling on device

- **Safari Web Inspector** over USB from the Mac (Timelines → JavaScript & Events, Rendering Frames, Memory). Works for Home Screen apps too.
- **iOS Simulator** for layout checks at iPhone sizes. Frame-rate truth only comes from the physical iPhone.
- An in-app **dev overlay** (dev mode): fps, frame time, draw calls, texture memory, sim time per race.

## Game-feel ("juice") principles applied to UI

- **Every tap answers immediately**: a press squash (scale about 0.96, shadow shortening), then a release with a spring.
- **Numbers never jump**: counts tick up, bars fill with a slight overshoot, currency flies from the source to its counter.
- **Anticipation → action → follow-through** on big moments: level-up, promotion, limit break, coupon reveal, badge unlock.
- **Layered feedback**: motion, sound, particles, and (where available) haptics, each scaled to the moment's importance. Small taps stay subtle so big moments land.
- **Respect `prefers-reduced-motion`**: no shake or parallax, shorter fanfares, and the same information conveyed.

## Sources

- [PixiJS News](https://pixijs.com/blog) · [PixiJS React v8](https://pixijs.com/blog/pixi-react-v8-live) · [PixiJS releases](https://github.com/pixijs/pixijs/releases) · [PixiJS in Production 2026](https://appscale.blog/en/blog/pixijs-high-performance-2d-web-graphics-2026)
- [WebKit bug 272165 — 120Hz rAF on iPhone](https://bugs.webkit.org/show_bug.cgi?id=272165) · [iDownloadBlog — 120fps browsing in Safari](https://www.idownloadblog.com/2026/05/04/120fps-browsing-safari/) · [MacRumors — 120Hz Safari](https://www.macrumors.com/how-to/enable-smoother-120hz-browsing-in-safari/)
- [WebGPU in iOS 26](https://appdevelopermagazine.com/webgpu-in-ios-26/) · [gpuweb Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [MagicBell — PWA iOS limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [MobiLoud — PWAs on iOS 2026](https://www.mobiloud.com/blog/progressive-web-apps-ios/) · [Michael Tsai — Web Apps in iOS 26](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/)
- [ios-haptics](https://github.com/tijnjh/ios-haptics) · [asuma — haptics in iOS Safari](https://medium.com/@posaune0423/i-open-sourced-an-oss-library-for-arbitrary-haptic-feedback-in-ios-safari-5b8ca74a5f05)
- [Motion — GSAP vs Motion](https://motion.dev/docs/gsap-vs-motion) · [OpenReplay — Motion vs GSAP](https://blog.openreplay.com/motion-vs-gsap/)
