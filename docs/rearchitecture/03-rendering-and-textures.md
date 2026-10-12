# 03 · Rendering and textures

How the racer draws its canvas scenes after the rebuild: one engine, one scene host, and a clear path for every texture
from its source to the GPU (D324).

## 1. Today

| Scene | Engine | Size | Loaded |
|---|---|---|---|
| `scenes/race/RaceScene.ts` (+ `presentation.ts` 334, `course-path.ts` 80) | PixiJS 8.20 | 514 lines | In the lazy `/race/run` chunk |
| `scenes/spark-rival/SparkRivalScene.ts` (+ proof, controller, pointer, feedback) | PixiJS 8 | about 1,300 lines | Lazy `/minigames/spark-match` (retired game, still routed) |
| `scenes/puzzles/PuzzleBattleScene.ts` | PixiJS 8 | 330 lines | Dynamic import |
| Home, Farm, RPG, Friendship, constellation graph | DOM + Motion, SVG | — | — |

Textures never go through a loader:
1. Images arrive as verified object URLs from `content/runtime.ts`.
2. They are decoded with `Image` and drawn onto a 2D canvas (circle clip, face crop).
3. The canvas becomes a texture with `Texture.from(canvas)`.
4. DOM sprites use CSS `background-position` into atlas pages (`ui/AtlasSprite.tsx`).

There is no pixel art and no tile map anywhere.

## 2. One engine: Phaser 4

**Phaser 4 draws every canvas scene the racer keeps or gains**: the Hub, the Farm and the race. This follows
platform P14 and matches uma-rpg, which runs its Hub and battles on Phaser 4.2 on the same iPhone.

Why Phaser 4 rather than staying on PixiJS:
- **The Hub and Farm are tile maps with cameras, tweens and animated sprites.** Phaser has all of that built in; on
  PixiJS each would be hand-built again.
- **Sharing.** The scene host, the Hub's map code and the art pipeline already exist for Phaser in uma-rpg and become
  `uma-scene` ([02](02-platform-and-packages.md) §4). Two engines would mean two hosts, two texture paths and two
  bundles to keep under budget.
- **One engine alive at a time** (platform architecture §4) is simplest when there is one engine.

**Exception, until the owner decides the Puzzles' future:** `PuzzleBattleScene` stays on PixiJS inside the Puzzles
chunk. PixiJS is then only downloaded by someone who opens a Puzzle battle. When the owner's docs settle the Puzzles,
the scene is ported to Phaser (about 330 lines) or leaves with the Puzzles for uma-puzzle. Either way, PixiJS then
leaves `package.json`.

**Spark Rival Circuit's scene is deleted** with the rest of the retired game.

## 3. The scene host

Every scene is mounted through `uma-scene` (uma-rpg's `createHubGame` / `createBattleGame`, generalised):

```ts
const game = await mountScene(container, { scene: FarmScene, setup, reducedMotion })
game.pause()   // the tab is hidden or an overlay covers it
game.resume()
game.destroy() // the screen closes: textures, listeners and the WebGL context go with it
```

- **Lazy:** Phaser and the scene's code load only when the screen opens. The Hub's chunk is the first one most
  sessions load, so its size is watched with the startup budget.
- **Sizing:** the canvas fills its container, renders at device pixels (DPR capped at 3) and is CSS-scaled. A
  `ResizeObserver` resizes it, and the scene re-lays out on `resize`, never on a frame count.
- **Lifecycle:** paused on `visibilitychange`, destroyed on unmount. At most one game exists: mounting a second
  destroys the first.
- **React over the canvas** for anything with text: HUD, menus, sheets, labels and hit targets are DOM elements
  positioned over the scene (uma-rpg's `PlaceTargets`). The canvas only draws, which keeps text sharp, accessible and
  outside WebGL.
- **Context loss:** on `webglcontextlost` the host destroys the game and remounts it from the same setup. Scenes hold
  no state that isn't in the setup or the store.
- **Reduced motion:** passed in the setup. Scenes shorten or skip tweens; playback can always jump to its end state.
- **Dev hooks:** `?canvas` forces a canvas renderer for the preview pane, which can't screenshot WebGL (as in uma-rpg).
  `window.__raceScene.seek / skipToEnd` stays for the race.

## 4. Where textures come from

| Source | What | Format | How it arrives |
|---|---|---|---|
| `@luismlorenzana/uma-art` | Pixel art: Hub tiles and buildings, Farm stations and items, UI emblems, effects | PNG atlas + JSON index, 16 or 32 px cells | Bundled by Vite (`?url` imports), so it is versioned with the app and precached by the service worker |
| uma-platform release | Uma art: outfit icons, busts, chibis, dresses, faces; card, skill and scenario icons | WebP atlases (128 px cells, pages ≤ 4096²) and single WebP images | `/api/master/files/*`, hash-verified, stored in Cache Storage, handed to the scene as object URLs |
| Racer overlays | Puzzle cast and monsters | WebP | `/api/content/files/*`, as today |
| Code | Course paths, bars, rings, particles, shadows | Phaser `Graphics` | Drawn at runtime |

### 4.1 Loading into Phaser

1. **Bundled atlases:** `this.load.atlas(key, pngUrl, frames)`, or the JSON index converted to Phaser frames once at
   startup. Frames are referenced by id, never by row and column.
2. **Release art:** the content client resolves an id to an object URL (art index → file → verified blob). The
   scene host's `addImageTexture(key, url)` decodes it with `createImageBitmap` and adds it with
   `textures.addImage`. A missing image resolves to `null` and the scene draws its fallback (a tinted silhouette or the
   outfit's icon), never a broken frame. This is uma-rpg's rule: missing art is fine.
3. **Composites** (a round face, a bust crop) are made once per texture key on an `OffscreenCanvas` and cached under
   that key. Today they are rebuilt per scene.

### 4.2 Pixel-art rules

- Phaser runs with `pixelArt: true` (nearest filtering, rounded positions) for every scene that shows pixel art.
- Pixel art is drawn at **whole-number scales** of its native size. The Hub picks the largest whole scale that fits
  the page's width (uma-rpg's `hubGrid`), and the DOM layer uses the same grid to place its targets.
- **Mixed scenes** need smooth sampling for the Uma art layered on the pixel ground. Set it per texture with
  `texture.setFilter(LINEAR)` for release art, so painted busts aren't jagged next to crisp pixel art.
- Tiles are 16 px, item and gear icons 32 px, buildings 48×48 with a ground line (`uma-art` contracts).

### 4.3 Memory on the iPhone

- Atlas pages stay at or under 4096² (Safari's texture limit on older devices), and most are far smaller (`uma-art`
  sheets are under 1100 px tall).
- **Per-scene ownership:**
  - A scene loads only what it shows: the Hub page's tiles and buildings plus the Umas on screen; the Farm district's
    stations plus its workers; the race's runners.
  - On `destroy`, every texture the scene added is removed and its object URLs are revoked.
  - The content client's LRU keeps blobs, not textures.
- **Budget:**
  - Keep a scene's GPU textures under about 64 MB.
  - A 4096² RGBA page is 64 MB on its own, so release atlases are only used through single-image lookups or 1024²
    pages in scenes.
  - The full atlas pages stay a DOM (CSS sprite) tool.
- WebP decodes off the main thread with `createImageBitmap`. PNG atlases from the bundle are small.

## 5. The scenes

### 5.1 Hub (new)

The pixel-art map of each Hub page ([04](04-hub.md)):
- Ground tiles autotiled from a terrain grid, with paths, water and props.
- Buildings at their place positions.
- Small life: idle sprites for the featured Uma and the workers, drawn from release chibis and code-animated (bob,
  hop, squash) as platform architecture §5 says.

Taps go to the DOM layer above, not to sprites.

### 5.2 Farm (new)

One district at a time, over its six stations ([05](05-farm.md) §5):
- **Each station** is an `uma-art` prop in its state: idle, working or ready.
- **Its worker's chibi** stands at it, code-animated: working loops; ready shows a sparkle and a bounce.
- **Job progress** is a ring drawn with `Graphics` from the job's own times, updated on elapsed time.

Swiping moves between the five districts. Tapping a station opens the DOM sheet.

### 5.3 Race (ported)

`presentation.ts` (cues, playback clock, stages, photo finish) and `course-path.ts` are already engine-free, and they
stay as they are. Only `RaceScene.ts` (514 lines) is rewritten for Phaser, keeping its public surface:
- `mount`, `setSpeed`, `seek`, `skipToEnd`, `setFaces`, `destroy`;
- the HUD callback.

So `RaceRunScreen` and its tests don't change. It keeps:
- the follow camera that turns with the pack so runners travel left to right;
- the minimap;
- the speed streaks;
- the staged start;
- the photo-finish slow-down.

The race plays a pre-computed timeline (`@racer/race`), so the port can't change a result. A test runs the same
timeline through both scenes' clocks and compares positions over time.

### 5.4 Puzzles (unchanged for now)

PixiJS, inside its chunk, until D324's exception resolves (§2).

## 6. Done when

- `pixi.js` is imported only under `scenes/puzzles/`, and the entry chunk contains neither engine.
- The Hub, Farm and race scenes mount and destroy through `uma-scene`. A test mounts and destroys each scene 20 times
  and the texture count returns to its start.
- On the owner's iPhone, at 390×844, the Hub pans and the Farm animates without dropped frames in Safari's timeline,
  and the race plays at 60 fps with 18 runners.
- Missing art (offline, or a new Uma without a chibi yet) draws the fallback, never a blank or broken sprite.
