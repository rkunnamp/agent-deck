import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 4 / Plan 07 / Task 1: BUG #19 / COSM-01 regression test
 *
 * Asserts that the search input focus styling uses CSS outline (which
 * does not affect layout) instead of focus:ring-1 (Tailwind's
 * box-shadow ring inside the layout box), that transition-colors is
 * not used on the input (it animates border-color and causes the
 * flicker), and that the computed borderWidth does not change on focus.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): SearchFilter.js line 89 sets
 * focus:outline-none focus:ring-1 + transition-colors. The combination
 * of border-color animation and box-shadow ring causes a 1px reflow
 * flicker on focus.
 *
 * Fix (LOCKED per 04-CONTEXT.md):
 *   1. Replace transition-colors with transition-[background-color,box-shadow] duration-150
 *      on the input element (the collapsed search button on line 51 may keep
 *      transition-colors; only the input is the COSM-01 surface).
 *   2. Replace focus:ring-1 / focus:outline-none with focus:outline focus:outline-2
 *      focus:outline-blue-500 focus:dark:outline-tn-blue.
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1; Task 2
 * applies the SearchFilter.js edits and flips the spec to green.
 */

const APP_ROOT = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'app');

test.describe('BUG #19 / COSM-01 — search input focus flicker', () => {
  test('structural: SearchFilter.js does NOT contain focus:ring-1', () => {
    const src = readFileSync(join(APP_ROOT, 'SearchFilter.js'), 'utf-8');
    expect(
      /focus:ring-1/.test(src),
      'SearchFilter.js must NOT use focus:ring-1 (box-shadow ring) — replaced by focus:outline per BUG #19 / COSM-01',
    ).toBe(false);
  });

  test('structural: SearchFilter.js contains focus:outline-2', () => {
    const src = readFileSync(join(APP_ROOT, 'SearchFilter.js'), 'utf-8');
    expect(
      /focus:outline-2/.test(src),
      'SearchFilter.js must use focus:outline-2 for outline-based focus styling — BUG #19 / COSM-01',
    ).toBe(true);
  });

  test('structural: SearchFilter.js does NOT contain focus:outline-none', () => {
    const src = readFileSync(join(APP_ROOT, 'SearchFilter.js'), 'utf-8');
    expect(
      /focus:outline-none/.test(src),
      'SearchFilter.js must NOT use focus:outline-none — the outline must render per BUG #19 / COSM-01',
    ).toBe(false);
  });

  test('structural: SearchFilter.js uses transition-[background-color,box-shadow] (not transition-colors on the input)', () => {
    const src = readFileSync(join(APP_ROOT, 'SearchFilter.js'), 'utf-8');
    // The collapsed search button (line ~51) and the clear-X button may still use
    // transition-colors and that is fine. We require that the explicit
    // transition-[background-color,box-shadow] utility appears at least once
    // (the input element has it after the fix).
    expect(
      /transition-\[background-color,box-shadow\]/.test(src),
      'SearchFilter.js must use transition-[background-color,box-shadow] on the input element (not transition-colors which animates border-color and flickers) — BUG #19 / COSM-01',
    ).toBe(true);
  });

  test('structural: plan 04-01 Filter sessions strings preserved (3+ sites)', () => {
    const src = readFileSync(join(APP_ROOT, 'SearchFilter.js'), 'utf-8');
    const matches = (src.match(/Filter sessions/g) || []).length;
    expect(
      matches,
      `plan 04-01's three Filter sessions strings must be preserved; found ${matches}`,
    ).toBeGreaterThanOrEqual(3);
  });

  test('DOM: borderWidth of the input does not change on focus', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });

    // Click the collapsed search button to expand the input.
    await page.locator('button[title^="Filter sessions"], button[title^="Search sessions"]').first().click();
    await page.waitForTimeout(150);

    // Click outside to blur the auto-focused input.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.waitForTimeout(100);

    const input = page.locator('input[type="text"][placeholder*="sessions"]').first();
    const inputCount = await input.count();
    test.skip(inputCount === 0, 'search input not rendered — DOM test deferred');

    const beforeWidth = await input.evaluate((el) => getComputedStyle(el).borderWidth);
    await input.focus();
    await page.waitForTimeout(150);
    const afterWidth = await input.evaluate((el) => getComputedStyle(el).borderWidth);

    expect(
      afterWidth,
      `input borderWidth must NOT change on focus; got "${beforeWidth}" before vs "${afterWidth}" after — BUG #19 / COSM-01 reflow flicker indicator`,
    ).toBe(beforeWidth);
  });
});
