// Standalone Playwright config for visual/p3-bug19-focus-flicker.spec.ts.
// Used by Phase 4 / Plan 07 to reproduce and verify the BUG #19 / COSM-01
// search input focus flicker fix.
//
// Connects to a manually-started agent-deck web server on port 18427 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works in environments where the default webServer hook cannot spawn
// the TUI (e.g. inside a tmux session the binary rejects as nested).
//
// Port note: 18427 (not 18420 as referenced in the original PLAN.md text) —
// the executor environment block for Plan 04-07 mandates 18427 to avoid
// collision with stale processes from earlier Phase 4 plans that may still
// be holding 18420.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p3-bug19-focus-flicker.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18427',
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
