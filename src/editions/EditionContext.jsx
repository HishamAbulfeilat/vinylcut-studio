/**
 * Edition Context — manages the launch-time edition selection and
 * provides the capability table to the rest of the application.
 *
 * The edition is chosen once at launch (via the EditionChooser dialog)
 * and then remains fixed for the session. The capability table is
 * written to the context and used by components to gate their UI.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  EDITION_CAPABILITIES,
  DEFAULT_EDITION,
} from './capabilities'

const EditionContext = createContext(null)

/**
 * Internal: the default capability table (ART) used before the chooser runs.
 * In practice, the EditionProvider will be wrapped by the EditionChooser
 * which blocks rendering until an edition is selected.
 */
const DEFAULT_EDITION_ID = DEFAULT_EDITION

export function EditionProvider({ children, initialEdition = null }) {
  const [editionId, setEditionId] = useState(initialEdition || DEFAULT_EDITION_ID)
  const [isChoosing, setIsChoosing] = useState(!initialEdition)

  // Load saved edition preference from localStorage on mount
  useEffect(() => {
    if (!initialEdition) {
      const saved = localStorage.getItem('vcs:edition')
      if (saved && EDITION_CAPABILITIES[saved]) {
        setEditionId(saved)
      }
      setIsChoosing(true)
    }
  }, [initialEdition])

  const selectEdition = useCallback((id) => {
    if (EDITION_CAPABILITIES[id]) {
      setEditionId(id)
      localStorage.setItem('vcs:edition', id)
      setIsChoosing(false)
    }
  }, [])

  const resetEdition = useCallback(() => {
    localStorage.removeItem('vcs:edition')
    setEditionId(DEFAULT_EDITION_ID)
    setIsChoosing(true)
  }, [])

  const capabilities = EDITION_CAPABILITIES[editionId]
  const hasFeature = useCallback(
    (flag) => capabilities?.flags?.has(flag) ?? false,
    [capabilities]
  )

  const value = {
    editionId,
    edition: capabilities,
    selectEdition,
    resetEdition,
    hasFeature,
    isChoosing,
  }

  return (
    <EditionContext.Provider value={value}>
      {children}
    </EditionContext.Provider>
  )
}

/**
 * Hook to access the current edition's capabilities.
 * Returns { editionId, edition, selectEdition, resetEdition, hasFeature, isChoosing }
 */
export function useEdition() {
  const context = useContext(EditionContext)
  if (!context) {
    throw new Error('useEdition must be used within an EditionProvider')
  }
  return context
}