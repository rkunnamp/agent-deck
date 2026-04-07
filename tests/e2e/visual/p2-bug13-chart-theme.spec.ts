import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 4 / Plan 04 / Task 1: BUG #13 / UX-02 regression test
 *
 * Asserts that CostDashboard.js reads chart colors from CSS variables
 * via getComputedStyle, that --chart-* variables are defined in the
 * compiled styles.css for both light and dark themes, that the chart
 * rebuilds on theme toggle via a MutationObserver on
 * document.documentElement, and that the legacy hardcoded ternary
 * (tickColor = isDark ? ...) is removed.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): CostDashboard.js lines 65-69
 * hardcode every chart color via an isDark ternary; line 8 declares a
 * CHART_COLORS constant; lines 82-83 hardcode borderColor / backgroundColor;
 * line 119 hardcodes legendColor. The roadmap mandates these come from
 * CSS custom properties via getComputedStyle(document.documentElement),
 * with a MutationObserver on <html> so theme toggle re-reads and updates
 * the chart without page reload.
 *
 * Fix (LOCKED per 04-CONTEXT.md, two-part):
 *   Part A: Add --chart-text, --chart-grid, --chart-legend, --chart-primary,
 *           --chart-primary-fill, --chart-categorical-1..8 to styles.src.css
 *           in :root and html.dark blocks. Run make css to regenerate.
 *   Part B: Replace hardcoded constants with readChartTheme() helper,
 *           install MutationObserver on document.documentElement, remove
 *           CHART_COLORS and the isDark ternary.
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1; Task 2
 * applies the full Part A + Part B fix and flips the spec to green.
 */

const APP_ROOT = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'app');
const STATIC_ROOT = join(__dirname, '..', '..', '..', 'internal', 'web', 'static');

test.describe('BUG #13 / UX-02 — theme-aware Chart.js via CSS variables', () => {
  test('--chart-primary CSS variable is defined and non-empty', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    const value = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--chart-primary').trim()
    );
    expect(
      value.length,
      `--chart-primary must resolve to a non-empty value via getComputedStyle; got "${value}". This is the runtime gate for BUG #13 / UX-02.`,
    ).toBeGreaterThan(0);
  });

  test('--chart-text CSS variable differs between light and dark modes', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });

    // Force light mode
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(50);
    const lightText = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim()
    );

    // Force dark mode
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(50);
    const darkText = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim()
    );

    expect(lightText.length, 'light --chart-text must resolve to a non-empty value').toBeGreaterThan(0);
    expect(darkText.length, 'dark --chart-text must resolve to a non-empty value').toBeGreaterThan(0);
    expect(
      lightText,
      `light --chart-text (${lightText}) and dark --chart-text (${darkText}) must DIFFER — proves both :root and html.dark define the variable`,
    ).not.toBe(darkText);
  });

  test('structural: CostDashboard.js does not contain `tickColor = isDark`', () => {
    const src = readFileSync(join(APP_ROOT, 'CostDashboard.js'), 'utf-8');
    expect(
      /tickColor\s*=\s*isDark/.test(src),
      'CostDashboard.js must NOT contain `tickColor = isDark` ternary — replaced by readChartTheme() helper per BUG #13 / UX-02',
    ).toBe(false);
  });

  test('structural: CostDashboard.js does not declare top-level CHART_COLORS', () => {
    const src = readFileSync(join(APP_ROOT, 'CostDashboard.js'), 'utf-8');
    expect(
      /^const CHART_COLORS\s*=/m.test(src),
      'CostDashboard.js must NOT declare top-level `const CHART_COLORS = [...]` — replaced by readChartTheme().categorical per BUG #13 / UX-02',
    ).toBe(false);
  });

  test('structural: CostDashboard.js declares readChartTheme function', () => {
    const src = readFileSync(join(APP_ROOT, 'CostDashboard.js'), 'utf-8');
    expect(
      /function\s+readChartTheme|readChartTheme\s*=/.test(src),
      'CostDashboard.js must declare a readChartTheme function/binding — BUG #13 / UX-02',
    ).toBe(true);
  });

  test('structural: CostDashboard.js installs a MutationObserver and disconnects on cleanup', () => {
    const src = readFileSync(join(APP_ROOT, 'CostDashboard.js'), 'utf-8');
    expect(
      /MutationObserver/.test(src),
      'CostDashboard.js must use a MutationObserver to react to theme class changes — BUG #13 / UX-02',
    ).toBe(true);
    expect(
      /observer\.disconnect|\.disconnect\(\)/.test(src),
      'CostDashboard.js MutationObserver must call .disconnect() in cleanup — BUG #13 / UX-02 (paranoia: prevent leaks per 04-CONTEXT.md specifics line 543)',
    ).toBe(true);
  });

  test('structural: styles.src.css declares --chart-text and --chart-primary', () => {
    const src = readFileSync(join(STATIC_ROOT, 'styles.src.css'), 'utf-8');
    expect(
      /--chart-text/.test(src),
      'styles.src.css must declare --chart-text in :root and html.dark — BUG #13 / UX-02 Part A',
    ).toBe(true);
    expect(
      /--chart-primary/.test(src),
      'styles.src.css must declare --chart-primary in :root and html.dark — BUG #13 / UX-02 Part A',
    ).toBe(true);
  });

  test('structural: styles.css (compiled) contains --chart-text', () => {
    const src = readFileSync(join(STATIC_ROOT, 'styles.css'), 'utf-8');
    expect(
      /--chart-text/.test(src),
      'styles.css (compiled) must contain --chart-text — proves make css ran after the styles.src.css edit (BUG #13 / UX-02 Part A)',
    ).toBe(true);
  });
});
