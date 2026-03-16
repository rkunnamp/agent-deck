---
status: complete
phase: 18-wayland-key-input
source: 18-01-SUMMARY.md
started: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running agent-deck instance. Start agent-deck fresh. TUI boots without errors, session list renders, home screen displays correctly. No garbled output or escape sequence artifacts on screen.
result: pass

### 2. Keyboard Navigation Works
expected: Use arrow keys (up/down) to navigate the session list. Press Enter to select/attach. Press Escape or q to go back. All standard navigation keys respond correctly without producing stray characters or "u" suffixed output.
result: pass

### 3. Ctrl Key Shortcuts Function
expected: Press Ctrl+C in the TUI (should not crash or produce garbled output). Try other Ctrl shortcuts the TUI supports (e.g., Ctrl+N for new session if applicable). Keys respond as expected rather than printing CSI u escape sequences like `[99;5u`.
result: pass

### 4. Terminal Restored on Exit
expected: Quit agent-deck (q or Ctrl+C from home). After exit, type normally in your shell. Keys produce normal characters. No lingering keyboard mode changes (e.g., typing "a" doesn't produce escape sequences). Terminal is fully back to normal.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
