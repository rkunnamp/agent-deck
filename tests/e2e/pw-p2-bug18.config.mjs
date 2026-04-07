// Standalone Playwright config for visual/p2-bug18-truncation-depth.spec.ts.
// Used by Phase 4 / Plan 09 to reproduce and verify the BUG #18 / UX-07
// truncation depth audit fix.
//
// Connects to a manually-started agent-deck web server on port 18429 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works in environments where the default webServer hook cannot spawn
// the TUI (e.g. inside a tmux session the binary rejects as nested).
//
// Port 18429 is used because the gsd-phase4-exec worktree environment runs
// parallel plans and reserves earlier ports (18420..18428) for other specs.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p2-bug18-truncation-depth.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18429',
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
