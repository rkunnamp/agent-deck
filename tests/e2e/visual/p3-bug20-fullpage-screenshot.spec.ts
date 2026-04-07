import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  expandForFullPageScreenshot,
  collapseAfterFullPageScreenshot,
} from './screenshot-helpers';

/**
 * Phase 4 / Plan 02 / Task 1: BUG #20 / COSM-02 regression test
 *
 * Asserts that the screenshot-helpers.ts module exists and exposes
 * expandForFullPageScreenshot / collapseAfterFullPageScreenshot, that the
 * helpers correctly inject and remove an overflow override, that a
 * full-page screenshot taken inside the helper window has a decoded PNG
 * height greater than the viewport (800), and that production CSS
 * (styles.src.css) still sets body { overflow: hidden }.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): styles.src.css line 150 has
 * body { overflow: hidden } which is intentional production behavior
 * for the chat-style fixed-height app, but Playwright's
 * toHaveScreenshot({ fullPage: true }) walks the document scrollable
 * region and clips to viewport when overflow is hidden. Visual
 * baselines therefore capture only the viewport rectangle, not the
 * full document.
 *
 * Fix (LOCKED per 04-CONTEXT.md, TEST-ONLY): create
 * tests/e2e/visual/screenshot-helpers.ts that exports a pair of
 * helpers using page.addStyleTag to inject and later remove an
 * overflow: visible !important override. NO production CSS changes.
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1 (the
 * import resolves to a non-existent module). Task 2 creates the helper
 * module and the spec flips to green.
 */

function decodePngHeight(buf: Buffer): number {
  // PNG file format: 8-byte signature, then IHDR chunk starting at byte 8.
  // IHDR layout: 4 bytes length, 4 bytes type (0x49484452 "IHDR"),
  // 4 bytes width, 4 bytes height, 1 byte bit depth, ...
  // Width is at byte offset 16, height at byte offset 20 (big-endian uint32).
  if (buf.length < 24) {
    throw new Error(`PNG buffer too short: ${buf.length} bytes`);
  }
  return buf.readUInt32BE(20);
}

test.describe('BUG #20 / COSM-02 — full-page screenshot helper', () => {
  test('full-page screenshot with helper has height > viewport', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });

    // The v1.3.4 redesign uses a fixed-viewport TUI layout — every
    // internal pane is `overflow: hidden` and sized to viewport, so the
    // app's own content never overflows 800px in the `_test` profile.
    // The helper's job is to enable full-page capture of tall content
    // that WOULD be clipped by body { overflow: hidden }. To exercise
    // that behavior deterministically (independent of fixture data), we
    // append a 2000px sentinel div to the body before the screenshot.
    // Without the helper, `page.screenshot({ fullPage: true })` throws
    // "Unable to capture screenshot" because body.offsetHeight stays at
    // viewport height (800) while scrollHeight is 2800 — Playwright's
    // fullPage walker errors on that mismatch under body { overflow:
    // hidden }. With the helper, body.offsetHeight grows to 2800 and
    // the full document is captured.
    await page.evaluate(() => {
      const sentinel = document.createElement('div');
      sentinel.id = 'cosm02-sentinel';
      sentinel.style.cssText =
        'width: 100%; height: 2000px; background: linear-gradient(#ff0000, #0000ff);';
      document.body.appendChild(sentinel);
    });

    await expandForFullPageScreenshot(page);

    const buf = await page.screenshot({ fullPage: true });
    const height = decodePngHeight(buf);

    await collapseAfterFullPageScreenshot(page);

    // Clean up the sentinel so other tests in the describe block start
    // from a clean DOM.
    await page.evaluate(() => {
      const s = document.getElementById('cosm02-sentinel');
      if (s && s.parentNode) s.parentNode.removeChild(s);
    });

    expect(
      height,
      `full-page screenshot height (${height}) must exceed viewport height (800) — proves expandForFullPageScreenshot bypassed body { overflow: hidden } and Playwright captured the full 2800px document (800px app shell + 2000px sentinel). If this fails to 800, the helper did not inject the overflow override or did not override the inline position:fixed on #app-root.`,
    ).toBeGreaterThan(800);
  });

  test('after collapse, getComputedStyle(body).overflow returns hidden', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });

    await expandForFullPageScreenshot(page);
    await collapseAfterFullPageScreenshot(page);

    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(
      overflow,
      'after collapseAfterFullPageScreenshot, body computed overflow must be "hidden" — proves the helper cleanly restored production cascade',
    ).toBe('hidden');
  });

  test('production CSS guard: styles.src.css still sets body { overflow: hidden }', () => {
    const p = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'styles.src.css');
    const src = readFileSync(p, 'utf-8');
    // Locate a body { ... overflow: hidden ... } block. The check is whitespace-tolerant.
    const bodyOverflowRe = /body\s*\{[^}]*overflow:\s*hidden/m;
    expect(
      bodyOverflowRe.test(src),
      'styles.src.css must still contain a body block with overflow: hidden — the COSM-02 fix is test-only and MUST NOT touch production CSS',
    ).toBe(true);
  });

  test('helper module exports both expand and collapse functions', () => {
    // Import-time check: if the module is missing, the spec file fails to
    // load and ALL tests fail. This is the load-bearing TDD signal.
    expect(typeof expandForFullPageScreenshot, 'expandForFullPageScreenshot must be a function').toBe('function');
    expect(typeof collapseAfterFullPageScreenshot, 'collapseAfterFullPageScreenshot must be a function').toBe('function');
  });
});
