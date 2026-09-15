import { describe, expect, it } from 'vitest'
import { parseContentAtlas, parseContentManifest, parseContentPack } from './parse'

describe('content parsing', () => {
  it('accepts a valid manifest and rejects duplicate paths', () => {
    const file = { path: 'data/umas.1234abcd.json', bytes: 1, sha256: 'a'.repeat(64) }
    expect(
      parseContentManifest({
        version: 'b'.repeat(12),
        generatedAt: '2099-01-01T00:00:00.000Z',
        source: { characters: 'synthetic' },
        files: [file],
      }),
    ).toMatchObject({ version: 'b'.repeat(12) })
    expect(() =>
      parseContentManifest({
        version: 'b'.repeat(12),
        generatedAt: '2099-01-01T00:00:00.000Z',
        source: {},
        files: [file, file],
      }),
    ).toThrow('duplicate paths')
  })

  it('rejects duplicate ids in a pack', () => {
    expect(() => parseContentPack({ version: 'synthetic', items: [{ id: 'x' }, { id: 'x' }] }, 'uma')).toThrow(
      'Duplicate uma id',
    )
  })

  it('validates atlas page bounds and frame overlap', () => {
    const base = {
      schemaVersion: 1,
      kind: 'uma-icons',
      frameWidth: 128,
      frameHeight: 128,
      pages: [{ path: 'atlases/uma-icons-0.1234abcd.webp', width: 264, height: 132 }],
      frames: { a: { page: 0, x: 2, y: 2, width: 128, height: 128 } },
    }
    expect(parseContentAtlas(base, 'uma-icons').frames.a).toMatchObject({ x: 2, y: 2 })
    expect(() =>
      parseContentAtlas({ ...base, frames: { a: { page: 0, x: 200, y: 2, width: 128, height: 128 } } }, 'uma-icons'),
    ).toThrow('Out-of-bounds')
    expect(() =>
      parseContentAtlas(
        {
          ...base,
          frames: {
            a: { page: 0, x: 2, y: 2, width: 128, height: 128 },
            b: { page: 0, x: 3, y: 2, width: 128, height: 128 },
          },
        },
        'uma-icons',
      ),
    ).toThrow('Overlapping')
  })
})
