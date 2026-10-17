/**
 * Edition Chooser — launch-time dialog for selecting the edition.
 * Blocks app rendering until an edition is chosen.
 */

import React from 'react'
import { useEdition, EDITION_CAPABILITIES } from '../editions'
import './EditionChooser.css'

const EDITION_DETAILS = {
  ART: {
    tagline: 'Full professional sign-making surface',
    highlights: [
      'All 139 commands available',
      '46 tool layouts',
      'Complete text, font, curve & bitmap toolsets',
      'All effects, engraving & colour features',
      'Full output/RIP pipeline',
    ],
  },
  XPT: {
    tagline: 'Professional, minus some text & curve tools',
    highlights: [
      '120 commands, 39 tool layouts',
      'Full bitmap, effects & colour features',
      'Most curve joins & text-to-path tools',
      'Full output/RIP pipeline',
    ],
  },
  PRO: {
    tagline: 'Mid-tier, text & node editing reduced',
    highlights: [
      '102 commands, 27 tool layouts',
      'Basic text-to-path & curve joins',
      'Colour libraries & layout tools',
      'Full output/RIP pipeline',
    ],
  },
  'CUT+ARMS': {
    tagline: 'Entry cutting edition with ARMS mark-sensor support',
    highlights: [
      '81 commands, 20 tool layouts',
      'Basic text-to-path & curve joins',
      'Centre/move page, master pages',
      'Cut Selected + RIP Spooler',
      'ARMS automated mark-sensor hardware',
    ],
  },
  CUT: {
    tagline: 'Entry cutting edition',
    highlights: [
      '81 commands, 20 tool layouts',
      'Basic text-to-path & curve joins',
      'Centre/move page, master pages',
      'Cut Selected + RIP Spooler',
    ],
  },
}

export default function EditionChooser({ onContinue }) {
  const { selectEdition, editionId, isChoosing } = useEdition()

  if (!isChoosing) {
    return onContinue ? onContinue() : null
  }

  const handleSelect = (id) => {
    selectEdition(id)
    if (onContinue) onContinue()
  }

  return (
    <div className="edition-chooser-overlay" role="dialog" aria-modal="true" aria-labelledby="chooser-title">
      <div className="edition-chooser">
        <div className="chooser-header">
          <h1 id="chooser-title">VinylCut Studio</h1>
          <p className="chooser-subtitle">Select your edition to continue</p>
        </div>

        <div className="edition-cards" role="radiogroup" aria-label="Edition">
          {Object.entries(EDITION_DETAILS).map(([id, detail]) => (
            <button
              key={id}
              className={`edition-card ${editionId === id ? 'selected' : ''}`}
              role="radio"
              aria-checked={editionId === id}
              onClick={() => handleSelect(id)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(id) } }}
            >
              <div className="card-badge">{id}</div>
              <h2 className="card-name">{EDITION_CAPABILITIES[id]?.name || id}</h2>
              <p className="card-tagline">{detail.tagline}</p>
              <ul className="card-highlights">
                {detail.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
              <div className="card-command-count">
                {EDITION_CAPABILITIES[id]?.commandCount} commands · {EDITION_CAPABILITIES[id]?.toolLayoutCount} tool layouts
              </div>
            </button>
          ))}
        </div>

        <div className="chooser-footer">
          <button
            className="chooser-continue"
            onClick={() => handleSelect(editionId)}
            disabled={!editionId}
          >
            Continue with {editionId}
          </button>
          <p className="chooser-note">
            You can change this later via <kbd>Help</kbd> → <kbd>Setup Wizard</kbd> (ART/XPT/PRO) or by clearing app data.
          </p>
        </div>
      </div>
    </div>
  )
}