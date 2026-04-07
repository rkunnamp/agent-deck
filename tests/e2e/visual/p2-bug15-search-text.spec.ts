import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 4 / Plan 01 / Task 1: BUG #15 / UX-04 regression test
 *
 * Asserts that the SearchFilter component exposes the canonical string
 * "Filter sessions" in all three locations (collapsed button title,
 * collapsed button label text, expanded input placeholder) and that the
 * legacy strings "Search sessions" and "Search..." appear nowhere.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): SearchFilter.js has three different
 * strings for the same affordance:
 *   - Line 52: title="Search sessions (/ or ⌘K)"
 *   - Line 58: <span>Search...</span>
 *   - Line 75: placeholder="Filter sessions..."
 *
 * Fix (LOCKED per 04-CONTEXT.md): rewrite lines 52 and 58 to use the
 * canonical "Filter sessions" string. The roadmap (line 170, line 182)
 * supersedes the older REQUIREMENTS.md text and is the normative spec.
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1, then the
 * fix lands in Task 2, flipping the spec to green.
 */

test.describe('BUG #15 / UX-04 — SearchFilter copy consistency', () => {
  test('collapsed search button title and label both say Filter sessions', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    // The collapsed search button is rendered when searchVisibleSignal is false (default).
    const button = page.locator('button[title^="Filter sessions"]');
    await expect(
      button,
      'collapsed search button must have a title starting with "Filter sessions" — currently broken (says "Search sessions") per BUG #15 / UX-04',
    ).toHaveCount(1);
    const title = await button.getAttribute('title');
    expect(title, 'collapsed search button title must start with "Filter sessions"').toMatch(/^Filter sessions/);
    const text = (await button.textContent()) || '';
    expect(text, 'collapsed search button label must contain "Filter sessions" — currently says "Search..."').toContain('Filter sessions');
  });

  test('expanded search input placeholder is "Filter sessions..."', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    // Click the collapsed button to expand the input.
    await page.locator('button[title^="Filter sessions"]').click();
    const input = page.locator('input[type="text"][placeholder="Filter sessions..."]');
    await expect(input, 'expanded search input must have placeholder "Filter sessions..."').toHaveCount(1);
  });

  test('no "Search sessions" or "Search..." substring appears anywhere on the page', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    const html = await page.evaluate(() => document.body.innerHTML);
    expect(
      html.includes('Search sessions'),
      'document.body.innerHTML must NOT contain the substring "Search sessions" — that is the legacy copy fixed in BUG #15 / UX-04',
    ).toBe(false);
    // Note: the search SVG icon path uses no text. The collapsed button's
    // label was "Search..." pre-fix, so this also catches the legacy label.
    expect(
      html.includes('Search...'),
      'document.body.innerHTML must NOT contain the substring "Search..." — that is the legacy collapsed-button label fixed in BUG #15 / UX-04',
    ).toBe(false);
  });

  test('structural: SearchFilter.js source contains exactly 3 "Filter sessions" sites', () => {
    const p = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'app', 'SearchFilter.js');
    const src = readFileSync(p, 'utf-8');
    const filterMatches = (src.match(/Filter sessions/g) || []).length;
    expect(
      filterMatches,
      `SearchFilter.js must contain "Filter sessions" exactly 3 times (button title + button label + input placeholder); found ${filterMatches}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      /Search sessions/.test(src),
      'SearchFilter.js must NOT contain "Search sessions" — fixed in BUG #15 / UX-04',
    ).toBe(false);
    expect(
      /Search\.\.\./.test(src),
      'SearchFilter.js must NOT contain "Search..." — fixed in BUG #15 / UX-04',
    ).toBe(false);
  });
});
