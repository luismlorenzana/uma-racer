// Standalone CommonJS Farm mirror; byte parity tests guard every source file (implementation §5).
export * from './farm-domain/farm/kitchen/index'
/** Matching web/API gates stay false until the complete T124 release. */
export const FARM_KITCHEN_RELEASE_ENABLED = false
