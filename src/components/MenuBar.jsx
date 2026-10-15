import React, { useState } from 'react'
import './MenuBar.css'

export default function MenuBar({
  onNew, onOpen, onSave, onExport, onPrint,
  onUndo, onRedo, onCut, onCopy, onPaste, onDelete, onSelectAll,
  onZoomIn, onZoomOut, onZoomToAll, onZoomToPage
}) {
  const [openMenu, setOpenMenu] = useState(null)

  const menus = [
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', action: onNew },
        { label: 'Open...', shortcut: 'Ctrl+O', action: onOpen },
        { type: 'separator' },
        { label: 'Save', shortcut: 'Ctrl+S', action: onSave },
        { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: onSave },
        { type: 'separator' },
        { label: 'Export...', shortcut: 'Ctrl+E', action: onExport },
        { label: 'Print...', shortcut: 'Ctrl+P', action: onPrint },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: onRedo },
        { type: 'separator' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: onCut },
        { label: 'Copy', shortcut: 'Ctrl+C', action: onCopy },
        { label: 'Paste', shortcut: 'Ctrl+V', action: onPaste },
        { type: 'separator' },
        { label: 'Delete', shortcut: 'Del', action: onDelete },
        { label: 'Select All', shortcut: 'Ctrl+A', action: onSelectAll },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', shortcut: 'F3', action: onZoomIn },
        { label: 'Zoom Out', shortcut: 'F4', action: onZoomOut },
        { type: 'separator' },
        { label: 'Zoom to All', shortcut: 'F5', action: onZoomToAll },
        { label: 'Zoom to Page', shortcut: 'F6', action: onZoomToPage },
      ]
    },
    {
      label: 'Object',
      items: [
        { label: 'Group', shortcut: 'Ctrl+G' },
        { label: 'Ungroup', shortcut: 'Ctrl+U' },
        { type: 'separator' },
        { label: 'Bring to Front', shortcut: 'Shift+PgUp' },
        { label: 'Send to Back', shortcut: 'Shift+PgDn' },
        { type: 'separator' },
        { label: 'Mirror Horizontally' },
        { label: 'Mirror Vertically' },
        { type: 'separator' },
        { label: 'Rotate 90°', shortcut: 'Ctrl+R' },
        { label: 'Rotate 180°' },
        { label: 'Rotate 270°' },
      ]
    },
    {
      label: 'Arrange',
      items: [
        { label: 'Align Left', shortcut: 'L' },
        { label: 'Align Right', shortcut: 'R' },
        { label: 'Align Top', shortcut: 'T' },
        { label: 'Align Bottom', shortcut: 'B' },
        { type: 'separator' },
        { label: 'Align Centers Horizontally', shortcut: 'E' },
        { label: 'Align Centers Vertically', shortcut: 'C' },
        { type: 'separator' },
        { label: 'Distribute...' },
        { label: 'Step and Repeat...' },
      ]
    },
    {
      label: 'Effects',
      items: [
        { label: '3D Effects' },
        { label: 'Block Shadow' },
        { label: 'Drop Shadow' },
        { label: 'Soft Shadow' },
        { type: 'separator' },
        { label: 'Outline' },
        { label: 'Multi-Outline' },
        { label: 'Multi-Inline' },
        { type: 'separator' },
        { label: 'Glow' },
        { label: 'Tint Map' },
      ]
    },
    {
      label: 'Tools',
      items: [
        { label: 'Vectorize (Trace)' },
        { label: 'Contour Cut Wizard' },
        { label: 'Vinyl Spooler', shortcut: 'Shift+Alt+V' },
        { type: 'separator' },
        { label: 'Clone Object' },
        { label: 'Matrix Array' },
        { label: 'Circle Array' },
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', shortcut: 'F1' },
        { label: 'Tutorials', shortcut: 'Ctrl+T' },
        { type: 'separator' },
        { label: 'About SignMaster Pro...' },
      ]
    },
  ]

  const handleMenuClick = (menuLabel) => {
    setOpenMenu(openMenu === menuLabel ? null : menuLabel)
  }

  const handleItemClick = (item) => {
    if (item.action) item.action()
    setOpenMenu(null)
  }

  return (
    <div className="menubar">
      <div className="menubar-brand">
        <span className="brand-icon">✂</span>
        <span className="brand-text">SignMaster Pro</span>
      </div>
      <div className="menubar-menus">
        {menus.map((menu) => (
          <div key={menu.label} className="menu-item">
            <button
              className={`menu-button ${openMenu === menu.label ? 'active' : ''}`}
              onClick={() => handleMenuClick(menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div className="dropdown">
                {menu.items.map((item, idx) =>
                  item.type === 'separator' ? (
                    <div key={idx} className="separator" />
                  ) : (
                    <button
                      key={idx}
                      className="dropdown-item"
                      onClick={() => handleItemClick(item)}
                    >
                      <span className="item-label">{item.label}</span>
                      {item.shortcut && <span className="item-shortcut">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
