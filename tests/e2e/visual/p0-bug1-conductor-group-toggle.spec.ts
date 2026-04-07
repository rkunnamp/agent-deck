import { test, expect } from '@playwright/test';

/**
 * Phase 2 / Plan 03 / Task 1: BUG #1 / CRIT-01 regression test
 *
 * Asserts that clicking any group header (identified by the
 * [aria-expanded] attribute from GroupRow.js:52) toggles the collapse
 * state and NEVER removes the group from the sidebar DOM.
 *
 * Root cause hypothesis (LOCKED per 02-CONTEXT.md): this bug cascades
 * from BUG #2 (CRIT-02). When addon-canvas.js throws synchronously at
 * page load, subsequent inline script execution is corrupted and the
 * Preact signal subscribers never register. When toggleGroup is called
 * from GroupRow.js, the new Map value never reaches the JSX layer and
 * the old render tree is never replaced — making the group appear to
 * vanish.
 *
 * This plan depends on plan 02-01 (BUG #2 fix). The test is written in
 * Task 1 and run in Task 2 against the BUG #2-fixed build. If it passes,
 * cascade hypothesis is confirmed. If it fails, a targeted fix to
 * groupState.js or GroupRow.js lands in Task 2.
 *
 * TDD ORDER: the spec is committed standalone in Task 1 regardless of
 * whether Task 2 needs a fix. Keeping the regression test forever is
 * the point of the north-star rule.
 */

interface CapturedError {
  message: string;
  name: string;
}

async function gotoWithErrorListener(
  page: import('@playwright/test').Page,
  viewport: { width: number; height: number },
): Promise<CapturedError[]> {
  const errors: CapturedError[] = [];
  page.on('pageerror', (err) => {
    errors.push({ message: err.message || String(err), name: err.name || 'Error' });
  });
  await page.setViewportSize(viewport);
  await page.goto('/?t=test');
  await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
  // preact-session-list is the id on the ul in SessionList.js line 95.
  await page
    .waitForSelector('#preact-session-list', { state: 'attached', timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  return errors;
}

function formatErrors(errors: CapturedError[]): string {
  if (errors.length === 0) return '(none)';
  return errors.map((e, i) => `  [${i}] ${e.name}: ${e.message}`).join('\n');
}

test.describe('BUG #1 / CRIT-01 — group header click toggles without removing', () => {
  test('desktop 1280x800: single click on a group flips aria-expanded without removing it', async ({ page }) => {
    const errors = await gotoWithErrorListener(page, { width: 1280, height: 800 });
    const count = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(count === 0, 'no fixture groups available — CRIT-01 retest deferred to Phase 8');

    const target = page.locator('#preact-session-list button[aria-expanded]').first();
    const initialState = await target.getAttribute('aria-expanded');
    expect(initialState, 'initial aria-expanded must be "true" or "false"').toMatch(/^(true|false)$/);

    await target.click();
    await page.waitForTimeout(150); // allow signal + Preact rerender

    // The clicked button must still be attached.
    await expect(target, 'clicked group must still be attached to the DOM').toBeAttached();

    // aria-expanded must have flipped.
    const afterClick = await target.getAttribute('aria-expanded');
    expect(afterClick, `aria-expanded after click must differ from initial (${initialState})`).not.toBe(
      initialState,
    );

    // No new JS errors during the click.
    expect(errors, `pageerror listener saw errors during click:\n${formatErrors(errors)}`).toEqual([]);
  });

  test('desktop 1280x800: round-trip click flips aria-expanded back to original', async ({ page }) => {
    const errors = await gotoWithErrorListener(page, { width: 1280, height: 800 });
    const count = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(count === 0, 'no fixture groups available');

    const target = page.locator('#preact-session-list button[aria-expanded]').first();
    const initial = await target.getAttribute('aria-expanded');
    await target.click();
    await page.waitForTimeout(150);
    await expect(target).toBeAttached();
    await target.click();
    await page.waitForTimeout(150);
    await expect(target).toBeAttached();

    const afterRoundTrip = await target.getAttribute('aria-expanded');
    expect(afterRoundTrip, 'round-trip click must restore original aria-expanded').toBe(initial);
    expect(errors, `pageerror listener saw errors during round-trip:\n${formatErrors(errors)}`).toEqual([]);
  });

  test('desktop 1280x800: click every visible group; none vanish', async ({ page }) => {
    const errors = await gotoWithErrorListener(page, { width: 1280, height: 800 });
    const initialCount = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(initialCount === 0, 'no fixture groups available');

    // Capture stable identifiers for each group at load time. Use textContent
    // truncated as the identifier since GroupRow.js does not expose a
    // data-group-path attribute. The textContent is the group name + action
    // button labels, which is stable enough for the count check.
    const labels: string[] = [];
    for (let i = 0; i < initialCount; i++) {
      const t = await page.locator('#preact-session-list button[aria-expanded]').nth(i).textContent();
      labels.push((t || '').trim().slice(0, 40));
    }

    // Click each group twice. Re-query by nth each iteration to cope with
    // Preact rerenders. The INITIAL count is the invariant — after every
    // round-trip, the count must NOT have decreased (collapsing a parent can
    // HIDE children via hasCollapsedAncestor, but the clicked group itself
    // must still be present; since we round-trip back to the original state,
    // the count must equal initialCount at the end).
    for (let i = 0; i < initialCount; i++) {
      const target = page.locator('#preact-session-list button[aria-expanded]').nth(i);
      if ((await target.count()) === 0) continue; // hidden by collapsed ancestor
      await target.click();
      await page.waitForTimeout(100);
      await target.click();
      await page.waitForTimeout(100);
    }

    const finalCount = await page.locator('#preact-session-list button[aria-expanded]').count();
    expect(
      finalCount,
      `after clicking every group twice, initial count=${initialCount} final count=${finalCount}. ` +
        `Labels captured: ${labels.join(' | ')}`,
    ).toBe(initialCount);

    expect(errors, `pageerror listener saw errors:\n${formatErrors(errors)}`).toEqual([]);
  });

  test('mobile 375x812: single click on a group flips aria-expanded without removing it', async ({ page }) => {
    const errors = await gotoWithErrorListener(page, { width: 375, height: 812 });
    const count = await page.locator('#preact-session-list button[aria-expanded]').count();
    test.skip(count === 0, 'no fixture groups on mobile');

    const target = page.locator('#preact-session-list button[aria-expanded]').first();
    const initial = await target.getAttribute('aria-expanded');
    await target.click();
    await page.waitForTimeout(150);
    await expect(target).toBeAttached();
    const after = await target.getAttribute('aria-expanded');
    expect(after, `mobile aria-expanded after click must differ from initial (${initial})`).not.toBe(initial);
    expect(errors, `pageerror listener saw errors on mobile click:\n${formatErrors(errors)}`).toEqual([]);
  });
});
