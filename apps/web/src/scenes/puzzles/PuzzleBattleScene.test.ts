// @vitest-environment jsdom
// CPU renderer double, actual native event wiring/controller; browser screenshots cover real WebGL.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPuzzleBattle } from '@racer/domain'
import { puzzlePracticeInput } from '../../game/puzzles/practice-input'
import { PuzzleBattleScene, puzzleArtSquare, type PuzzleSceneOptions } from './PuzzleBattleScene'
const runtime = vi.hoisted(() => ({ tick: null as ((ticker: { deltaMS: number }) => void) | null,
  resize: null as (() => void) | null, stopped: vi.fn(), destroyed: vi.fn() }))
vi.mock('pixi.js', () => {
  class Node {
    x = 0; y = 0; width = 0; height = 0; alpha = 1; visible = true
    position = { set: (x: number, y: number) => { this.x = x; this.y = y } }
    scale = { x: 1, set: (x: number) => { this.scale.x = x } }
    anchor = { set: () => {} }
    addChild() {}
    clear() { return this } circle() { return this } roundRect() { return this } fill() { return this }
    stroke() { return this } moveTo() { return this } lineTo() { return this } bezierCurveTo() { return this }
    closePath() { return this } ellipse() { return this }
  }
  class Application {
    stage = new Node(); canvas = document.createElement('canvas'); renderer = {}; captured = new Set<number>()
    ticker = { add: (tick: (ticker: { deltaMS: number }) => void) => { runtime.tick = tick } }
    constructor() {
      this.canvas.setPointerCapture = id => { this.captured.add(id) }
      this.canvas.hasPointerCapture = id => this.captured.has(id)
      this.canvas.releasePointerCapture = id => { this.captured.delete(id); const e = new Event('lostpointercapture'); Object.assign(e, { pointerId: id }); this.canvas.dispatchEvent(e) }
      this.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 430, right: 390, bottom: 430, x: 0, y: 0, toJSON: () => ({}) })
    }
    async init() {} start() {} stop() { runtime.stopped() } destroy() { runtime.destroyed(); this.canvas.remove() }
  }
  class Text extends Node { text = ''; style = { fill: 0 }; constructor() { super() } }
  return { Application, Container: Node, Graphics: Node, Sprite: Node, Text, Texture: { EMPTY: {}, from: () => ({ destroy: () => {} }) } }
})
let scene: PuzzleBattleScene, host: HTMLElement, act: ReturnType<typeof vi.fn<PuzzleSceneOptions['act']>>, now = 0
function pointer(type: string, id: number, x: number, y: number) {
  const e = new Event(type, { cancelable: true }); Object.assign(e, { pointerId: id, clientX: x, clientY: y, button: 0 })
  host.querySelector('canvas')!.dispatchEvent(e)
}
beforeEach(async () => {
  now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { runtime.resize = callback } observe() {} disconnect() {} })
  host = document.createElement('div'); Object.defineProperties(host, { clientWidth: { value: 390 }, clientHeight: { value: 430 } }); document.body.append(host)
  act = vi.fn(async () => {})
  scene = await PuzzleBattleScene.create({ host, state: createPuzzleBattle(puzzlePracticeInput()), art: { board: {}, enemies: [null, null, null], isolated: true },
    plain: true, reducedMotion: true, canInput: () => true, focus: () => 'practice-foe-1', act, hud: () => {} })
})
afterEach(() => { scene.destroy(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('native captured board events', () => {
  it('captures one pointer, ignores another, and releases once despite lost-capture notification', async () => {
    pointer('pointerdown', 1, 35, 160); pointer('pointerdown', 2, 94, 160)
    now = 100; pointer('pointermove', 2, 155, 218); pointer('pointermove', 1, 94, 160)
    now = 200; pointer('pointerup', 1, 94, 160); pointer('pointerup', 1, 94, 160)
    expect(act).toHaveBeenCalledOnce(); expect(act.mock.calls[0]![0]).toMatchObject({ type: 'drag', focusId: 'practice-foe-1', elapsedMs: 100 })
    expect(scene.pointer.current).toBeNull()
  })
  it('ticker expiry releases capture; later release cannot append again', () => {
    pointer('pointerdown', 1, 35, 160); now = 100; pointer('pointermove', 1, 94, 160)
    now = 7100; runtime.tick?.({ deltaMS: 16 }); pointer('pointerup', 1, 94, 160)
    expect(act).toHaveBeenCalledOnce(); expect(act.mock.calls[0]![0]).toMatchObject({ elapsedMs: 7000 })
  })
  for (const boundary of ['pointercancel', 'lostpointercapture', 'resize', 'pause', 'destroy'] as const) it(`${boundary} restores without submitting`, () => {
    pointer('pointerdown', 1, 35, 160); now = 100; pointer('pointermove', 1, 94, 160)
    if (boundary === 'resize') runtime.resize?.()
    else if (boundary === 'pause') scene.pause(true)
    else if (boundary === 'destroy') scene.destroy()
    else pointer(boundary, 1, 94, 160)
    expect(scene.pointer.current).toBeNull(); expect(act).not.toHaveBeenCalled()
  })
})

describe('orb art framing (D303)', () => {
  it('takes a square of a whole picture instead of stretching it: top of a tall figure, centre of a wide one', () => {
    const image = (naturalWidth: number, naturalHeight: number) => ({ naturalWidth, naturalHeight }) as unknown as HTMLImageElement
    // No canvas reads here, so these use the picture's own bounds.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(puzzleArtSquare(image(100, 300))).toEqual([0, 0, 100, 100])
    expect(puzzleArtSquare(image(300, 100))).toEqual([100, 0, 100, 100])
    expect(puzzleArtSquare(image(128, 128))).toEqual([0, 0, 128, 128])
  })
})
