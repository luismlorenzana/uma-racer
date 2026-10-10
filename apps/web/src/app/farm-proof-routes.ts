// DEV Farm kitchen proof bypasses auth/account/runtime and service-worker registration (T122).
export function isDevFarmKitchenProofPath(path: string): boolean {
  return /^\/dev\/farm-kitchen-proof(?:\/|$)/.test(path)
}
