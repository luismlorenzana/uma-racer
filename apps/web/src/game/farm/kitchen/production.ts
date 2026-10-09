// Lazy production factory. Capability-off/absent control keeps the legacy host; no read installs a fake writer.
import type { RacerDb } from '../../db'
import { parseSyncResponseOrThrow } from '@racer/domain'
import { saveApi } from '../../../api/client'
import { APP_BUILD_ID } from '../../../app/build'
import { appUpdateLifecycle } from '../../../app/update-lifecycle'
import { PersistentFarmKitchenHost } from './host'
import { FARM_KITCHEN_RELEASE_ENABLED } from './capability'
import type { FarmKitchenView } from './view'

export async function createProductionFarmKitchenHost(db: RacerDb, hooks: {
  current(): boolean; persistent(): boolean; safeToPrepare(): boolean; schedule(): void; publish(view: FarmKitchenView): Promise<void>
}): Promise<PersistentFarmKitchenHost> {
  const host: PersistentFarmKitchenHost = new PersistentFarmKitchenHost({ database: db, enabled: FARM_KITCHEN_RELEASE_ENABLED, ...hooks,
    // As with Settings' dev grants, the whole production API is owner-allowlisted; only a deliberate debug press calls this method.
    ownerDebugAllowed: () => hooks.current() && hooks.persistent(),
    recover: async operations => {
      const reply = parseSyncResponseOrThrow(await saveApi.sync({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations: operations }))
      return reply.farmOperations
    },
    cutover: async () => {
      const { firebaseEnabled, loadAuth } = await import('../../../auth/firebase')
      const accountId = firebaseEnabled ? (await loadAuth()).currentUser?.uid : 'local-dev'
      if (!accountId) throw new Error('Sign in to export or prepare this Farm account')
      return { accountId, build: APP_BUILD_ID, current: hooks.current, persistent: hooks.persistent,
        online: () => typeof navigator === 'undefined' || navigator.onLine,
        safeToPrepare: () => hooks.safeToPrepare() && appUpdateLifecycle.getSnapshot().activeActions === 0,
        snapshot: saveApi.load, prepare: saveApi.farmPrepare, publish: async () => hooks.publish(await host.read()) }
    },
  })
  return host
}
