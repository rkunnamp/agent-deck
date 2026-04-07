// Standalone Playwright config for visual/p2-bug15-search-text.spec.ts.
// Used by Phase 4 / Plan 01 to reproduce and verify the BUG #15 / UX-04
// search-placeholder consistency fix.
//
// Connects to a manually-started agent-deck web server on port 18421 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works in environments where the default webServer hook cannot spawn
// the TUI (e.g. inside a tmux session the binary rejects as nested).
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p2-bug15-search-text.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18421',
    headless: true,
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      Authorization: 'Bearer test',
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // No webServer block, server is started manually before this spec runs.
})
