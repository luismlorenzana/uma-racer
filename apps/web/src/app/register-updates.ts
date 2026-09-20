// Custom prompt registration replaces vite-plugin-pwa's silent auto reload.

import { registerSW } from 'virtual:pwa-register'
import { appUpdateLifecycle } from './update-lifecycle'

export function registerAppUpdates(): void {
  let activate = async () => {}
  activate = registerSW({
    immediate: true,
    onNeedRefresh: () => appUpdateLifecycle.workerWaiting(activate),
    onNeedReload: () => appUpdateLifecycle.workerControlled(() => window.location.reload()),
  })
}
