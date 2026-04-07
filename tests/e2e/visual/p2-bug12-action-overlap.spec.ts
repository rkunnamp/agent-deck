import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 4 / Plan 05 / Task 1: BUG #12 / UX-01 regression test
 *
 * Asserts that group action buttons do not overlap the session title at
 * narrow sidebar widths. The fix replaces opacity-0/opacity-100 (which
 * leaves the strip in the layout flow) with hidden/flex (which removes
 * it entirely until hover), and shrinks the inner buttons from 44px to
 * 36px to free space.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): GroupRow.js line 59 wraps the
 * action button strip in `opacity-0 group-hover:opacity-100
 * transition-opacity flex-shrink-0`. Three buttons at min-w-[44px]
 * consume 132 px even when invisible, plus chevron + count + title,
 * blowing past the 200 px sidebar minimum.
 *
 * Fix (LOCKED per 04-CONTEXT.md):
 *   1. Replace opacity-0 group-hover:opacity-100 with hidden group-hover:flex
 *   2. Change inner buttons from min-w-[44px] min-h-[44px] to min-w-[36px] min-h-[36px]
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1; Task 2
 * applies the GroupRow.js edits and flips the spec to green.
 */

const APP_ROOT = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'app');

test.describe('BUG #12 / UX-01 — group action button overlap at narrow widths', () => {
  test('structural: GroupRow.js does NOT contain opacity-0 group-hover:opacity-100 in the action strip', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /opacity-0\s+group-hover:opacity-100/.test(src),
      'GroupRow.js must NOT use opacity-0/opacity-100 hover trick (leaves strip in layout flow) — replaced by hidden/flex per BUG #12 / UX-01',
    ).toBe(false);
  });

  test('structural: GroupRow.js contains hidden group-hover:flex on the action strip', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /hidden\s+group-hover:flex/.test(src),
      'GroupRow.js action strip must use `hidden group-hover:flex` so display: none removes it from layout when not hovered — BUG #12 / UX-01',
    ).toBe(true);
  });

  test('structural: GroupRow.js inner action buttons use min-w-[36px] not min-w-[44px]', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    const count36 = (src.match(/min-w-\[36px\]/g) || []).length;
    const count44 = (src.match(/min-w-\[44px\]/g) || []).length;
    expect(
      count36,
      `GroupRow.js must declare min-w-[36px] for the three inner action buttons (BUG #12 / UX-01); found ${count36}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      count44,
      `GroupRow.js must NOT declare min-w-[44px] in the action button strip (replaced by 36px); found ${count44}`,
    ).toBe(0);
  });

  test('structural: GroupRow.js outer button still has the `group` class (parent contract for group-hover:*)', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /class="group w-full/.test(src) || /class="group\s+w-full/.test(src),
      'GroupRow.js outer button must still declare `class="group w-full ..."` so child .group-hover:* utilities resolve — BUG #12 / UX-01 parent contract',
    ).toBe(true);
  });

  test('DOM at 320px viewport: every group title span has boundingBox().width > 60', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(500);

    const groupCount = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(groupCount === 0, 'no fixture groups available — rely on structural tests + Phase 8 fixtures');

    const widths = await page.evaluate(() => {
      const out: Array<{ name: string; width: number }> = [];
      const buttons = document.querySelectorAll('#preact-session-list button[aria-expanded]');
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i] as HTMLElement;
        const titleSpan = btn.querySelector('span.truncate') as HTMLElement | null;
        if (!titleSpan) continue;
        const rect = titleSpan.getBoundingClientRect();
        out.push({ name: (titleSpan.textContent || '').slice(0, 40), width: rect.width });
      }
      return out;
    });

    for (const w of widths) {
      expect(
        w.width,
        `at 320px viewport, group title span "${w.name}" must have width > 60 px (not crushed by action strip); got ${w.width}`,
      ).toBeGreaterThan(60);
    }
  });

  test('DOM hover behavior: action strip is display:none until hover, display:flex on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(500);

    const groupCount = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(groupCount === 0, 'no fixture groups available — rely on structural tests + Phase 8 fixtures');

    // Find the FIRST group row (not the parent button — the inner action span).
    const firstGroup = page.locator('#preact-session-list button[aria-expanded]').first();
    const idleStripDisplay = await firstGroup.evaluate((btn) => {
      const strip = btn.querySelector('span > button[aria-label*="subgroup"], span > button[aria-label*="Rename"], span > button[aria-label*="Delete group"]');
      if (!strip) return 'no-strip-found';
      const parentSpan = strip.parentElement as HTMLElement;
      return getComputedStyle(parentSpan).display;
    });
    expect(
      idleStripDisplay,
      `action strip parent span must be display:none when not hovered; got "${idleStripDisplay}"`,
    ).toBe('none');

    await firstGroup.hover();
    await page.waitForTimeout(150);

    const hoverStripDisplay = await firstGroup.evaluate((btn) => {
      const strip = btn.querySelector('span > button[aria-label*="subgroup"], span > button[aria-label*="Rename"], span > button[aria-label*="Delete group"]');
      if (!strip) return 'no-strip-found';
      const parentSpan = strip.parentElement as HTMLElement;
      return getComputedStyle(parentSpan).display;
    });
    expect(
      hoverStripDisplay,
      `action strip parent span must be display:flex when hovered; got "${hoverStripDisplay}"`,
    ).toBe('flex');
  });
});
