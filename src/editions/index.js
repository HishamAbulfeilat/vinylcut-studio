/**
 * Editions capability system — single entry point.
 * Provides the capability table, feature flags, and helper functions
 * for gating UI surface by edition.
 */

export {
  FEATURE_FLAGS,
  EDITION_CAPABILITIES,
  EDITION_ORDER,
  DEFAULT_EDITION,
  getEditionCapabilities,
  editionHasFeature,
  getAllEditions,
  getEditionIds,
} from './capabilities'

/**
 * React hook for accessing the current edition's capabilities.
 * Must be used within an EditionProvider.
 */
export { useEdition, EditionProvider } from './EditionContext'