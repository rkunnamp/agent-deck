// Standalone Playwright config for visual/p2-bug17-action-bubble.spec.ts.
// Used by Phase 4 / Plan 08 to reproduce and verify the BUG #17 / UX-06
// action button bubble fix.
//
// Connects to a manually-started agent-deck web server on port 18428 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works in environments where the default webServer hook cannot spawn
// the TUI (e.g. inside a tmux session the binary rejects as nested).
//
// Port 18428 (not 18420) is used because the gsd-phase4-exec worktree
// environment runs parallel plans and reserves 18420 for other specs.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p2-bug17-action-bubble.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18428',
    headless: true,
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      Authorization: 'Bearer test',
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // No webServer block — server is started manually before this spec runs.
})
