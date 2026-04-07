// KeyboardShortcutsOverlay.js -- Modal overlay listing all keyboard shortcuts
// (BUG #14 / UX-03)
//
// Subscribes to shortcutsOverlaySignal. Opens via the ? key handler in
// useKeyboardNav.js, closes via Escape, click-outside (backdrop), or the
// close button. Stores document.activeElement on open and restores it on
// close. Two tabindex="0" sentinel divs trap focus inside the modal.
import { html } from 'htm/preact'
import { useEffect, useRef } from 'preact/hooks'
import { shortcutsOverlaySignal } from './state.js'

const SHORTCUT_GROUPS = [
  {
    category: 'Navigation',
    items: [
      { keys: ['j', '\u2193'], action: 'Focus next session' },
      { keys: ['k', '\u2191'], action: 'Focus previous session' },
      { keys: ['Enter'],       action: 'Select focused session' },
      { keys: ['Escape'],      action: 'Close current dialog' },
    ],
  },
  {
    category: 'Sessions',
    items: [
      { keys: ['n'], action: 'Create new session' },
      { keys: ['s'], action: 'Stop focused session (when running)' },
      { keys: ['r'], action: 'Restart focused session (when idle/stopped/error)' },
      { keys: ['d'], action: 'Delete focused session' },
    ],
  },
  {
    category: 'Search',
    items: [
      { keys: ['/'],            action: 'Open search' },
      { keys: ['Cmd/Ctrl', 'K'], action: 'Toggle search' },
      { keys: ['Escape'],       action: 'Close search' },
    ],
  },
  {
    category: 'Help',
    items: [
      { keys: ['?'], action: 'Show this overlay' },
    ],
  },
]

export function KeyboardShortcutsOverlay() {
  const open = shortcutsOverlaySignal.value
  const closeButtonRef = useRef(null)
  const lastActiveRef = useRef(null)

  useEffect(() => {
    if (!open) return

    // Store the previously-focused element so we can restore on close.
    lastActiveRef.current = document.activeElement
    // Focus the close button when the overlay opens.
    if (closeButtonRef.current) {
      closeButtonRef.current.focus()
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        shortcutsOverlaySignal.value = false
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Restore focus to the previously-active element on close.
      if (lastActiveRef.current && typeof lastActiveRef.current.focus === 'function') {
        lastActiveRef.current.focus()
      }
    }
  }, [open])

  if (!open) return null

  function handleBackdropClick(e) {
    // Only close if the click landed on the backdrop itself, not the inner panel.
    if (e.target === e.currentTarget) {
      shortcutsOverlaySignal.value = false
    }
  }

  function handleClose() {
    shortcutsOverlaySignal.value = false
  }

  // Focus trap sentinels: pressing Tab on the last sentinel jumps to the
  // close button; pressing Shift+Tab on the first sentinel jumps to the
  // close button. Minimal trap, ~6 lines.
  function trapToClose() {
    if (closeButtonRef.current) closeButtonRef.current.focus()
  }

  return html`
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick=${handleBackdropClick}
    >
      <div tabindex="0" onFocus=${trapToClose}></div>
      <div
        class="relative dark:bg-tn-panel bg-white dark:text-tn-fg text-gray-900
               rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto
               border dark:border-tn-muted/30 border-gray-200"
      >
        <div class="flex items-center justify-between px-sp-16 py-sp-12 border-b dark:border-tn-muted/20 border-gray-200">
          <h2 class="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            ref=${closeButtonRef}
            type="button"
            onClick=${handleClose}
            class="dark:text-tn-muted text-gray-400 hover:dark:text-tn-fg hover:text-gray-700
                   transition-colors w-8 h-8 flex items-center justify-center rounded"
            aria-label="Close shortcuts overlay"
          >\u2715</button>
        </div>
        <div class="px-sp-16 py-sp-12 space-y-sp-16">
          ${SHORTCUT_GROUPS.map(group => html`
            <section key=${group.category}>
              <h3 class="text-xs font-semibold uppercase tracking-wide dark:text-tn-muted text-gray-500 mb-sp-8">
                ${group.category}
              </h3>
              <dl class="space-y-sp-4">
                ${group.items.map(item => html`
                  <div class="flex items-center justify-between gap-sp-12 text-sm">
                    <dd class="dark:text-tn-fg text-gray-700 flex-1">${item.action}</dd>
                    <dt class="flex items-center gap-1 flex-shrink-0">
                      ${item.keys.map((k, i) => html`
                        ${i > 0 && html`<span class="text-xs dark:text-tn-muted text-gray-400">+</span>`}
                        <kbd class="text-xs dark:bg-tn-muted/20 bg-gray-100 dark:text-tn-fg text-gray-700
                                    border dark:border-tn-muted/30 border-gray-300 rounded px-1.5 py-0.5
                                    font-mono">${k}</kbd>
                      `)}
                    </dt>
                  </div>
                `)}
              </dl>
            </section>
          `)}
        </div>
      </div>
      <div tabindex="0" onFocus=${trapToClose}></div>
    </div>
  `
}
