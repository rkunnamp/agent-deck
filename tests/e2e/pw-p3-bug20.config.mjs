// Standalone Playwright config for visual/p3-bug20-fullpage-screenshot.spec.ts.
// Used by Phase 4 / Plan 02 to reproduce and verify the BUG #20 / COSM-02
// full-page screenshot helper fix.
//
// Connects to a manually-started agent-deck web server on port 18422 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works in environments where the default webServer hook cannot spawn
// the TUI (e.g. inside a tmux session the binary rejects as nested).
//
// Port note: the canonical Phase 2-4 test server port is 18420. Sibling
// worktrees (gsd-phase3-exec and gsd-phase4-polish) were already running
// test servers on 18420, and plan 04-01 switched its own config to 18421
// to avoid that collision. Plan 04-02 therefore takes 18422 so all three
// parallel worktrees can run simultaneously. This is the same Rule 3
// blocking-deviation pattern plan 04-01 documented (chore(04-01): switch
// bug15 test config to port 18421 to avoid parallel worktree collision).
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'visual/p3-bug20-fullpage-screenshot.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18422',
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
