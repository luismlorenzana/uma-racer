// Lazy real adapter only; no route switch or default double (docs/technical/uma-puzzles-implementation.md §5).
import { createPuzzleSource } from '@racer/domain'
import { saveApi } from '../../api/client'
import { puzzleContentLibrary } from '../../content/puzzles'
import type { LoadedContent } from '../../content/runtime'
import { db } from '../db'
import { PersistentPuzzleHost, type PuzzleHost } from './host'

export async function createPersistentPuzzleHost(content: LoadedContent, hooks: {
  schedule(): void; publish(): Promise<void>; flush(): Promise<void>
}): Promise<PuzzleHost> {
  const deviceId = await db.transaction('rw', db.puzzlePreferences, async () => {
    const row = await db.puzzlePreferences.get('device-id')
    if (row) {
      if (typeof row.value !== 'string' || !/^[a-zA-Z0-9:._-]{1,120}$/.test(row.value)) throw new Error('Puzzle device identity needs recovery')
      return row.value
    }
    // Device identity is NOT the board seed. The bank's immutable cutover id supplies that.
    const value = crypto.randomUUID()
    await db.puzzlePreferences.add({ id: 'device-id', value }); return value
  })
  return new PersistentPuzzleHost({ database: db, deviceId, content, ...hooks,
    source: id => {
      const template = content.umas.byId.get(id)
      if (!template) throw new Error('Verified original Uma template is unavailable')
      return createPuzzleSource(template, content.manifest.version)
    },
    acquire: async identity => {
      const lease = await puzzleContentLibrary(content.manifest).acquire(identity)
      return { identity: lease.identity, cast: lease.cast, release: lease.release, presentation: lease }
    },
    online: { available: () => typeof navigator === 'undefined' || navigator.onLine,
      flush: hooks.flush, takeover: saveApi.puzzleTakeover, snapshot: saveApi.load },
  })
}
