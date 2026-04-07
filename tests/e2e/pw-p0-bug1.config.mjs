// Standalone Playwright config for visual/p0-bug1-conductor-group-toggle.spec.ts.
// Used by Phase 2 / Plan 03 to reproduce and verify the BUG #1 / CRIT-01
// "clicking the CONDUCTOR group header makes the group vanish" fix.
//
// Connects to a manually-started agent-deck web server on port 18420 so the
// spec does not race the default playwright.config.ts webServer (port 19999)
// and works inside an agent-deck tmux session where the binary's nested-
// session detector blocks `go run ../../cmd/agent-deck --web`.
//
// Mirrors the Phase 2 plan-01/02 pattern (pw-bug2.config.mjs / pw-p0-bug3.config.mjs).
//
// Start the server with:
//   script -qc 'env -u TMUX -u TMUX_PANE -u TERM_PROGRAM AGENTDECK_PROFILE=_test \
//     ./build/agent-deck -p _test web --listen 127.0.0.1:18420' /dev/null \
//     > /tmp/p0-bug1-web.log 2>&1 &
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './visual',
  testMatch: 'p0-bug1-conductor-group-toggle.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:18420',
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
