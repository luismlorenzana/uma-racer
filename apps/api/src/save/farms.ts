// Standalone CommonJS Farm mirror; byte parity tests guard every source file (implementation §5).
export * from './farm-domain/farm/kitchen/index'
/** T124/D315: matching web/API release; protected preparation remains explicit and archive-gated. */
export const FARM_KITCHEN_RELEASE_ENABLED = true
