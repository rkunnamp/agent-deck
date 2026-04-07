// Standalone Playwright config for visual/p2-bug12-action-overlap.spec.ts.
// Used by Phase 4 / Plan 05 to reproduce and verify the BUG #12 / UX-01
// group action button overlap fix.
//
// Connects to a manually-started agent-deck web server on port 18425 so the
// spec does not race the default playwright.config.ts webServer (port 19999),
// avoids collision with ports used by Phase 2 specs (18420), Phase 4 plan 01
// (18421), Phase 4 plan 04 (18424), and works inside a tmux session where the
// binary rejects nested-session spawn.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p2-bug12-action-overlap.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18425',
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
