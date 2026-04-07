import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase 4 / Plan 08 / Task 1: BUG #17 / UX-06 regression test
 *
 * Asserts that clicking an action button in a session/group row's hover
 * strip does NOT bubble to the outer row click handler. The fix adds
 * onClick + onMouseDown stopPropagation handlers at the action span
 * level, in addition to the existing inner-button stopPropagation
 * handlers.
 *
 * Root cause (LOCKED per 04-CONTEXT.md): inner button handlers
 * (handleStop / handleRestart / handleDelete / handleFork) already
 * call e.stopPropagation() on the first line. But the row-level click
 * fires on mousedown during the focus shift before the inner button's
 * click event registers, so the row becomes selected even though the
 * user intended to delete/stop/restart it.
 *
 * Fix (LOCKED per 04-CONTEXT.md):
 *   1. Wrap the action <span> in onClick={(e) => e.stopPropagation()}
 *   2. Also add onMouseDown={(e) => e.stopPropagation()} (the
 *      load-bearing addition — catches the early mousedown event)
 *   3. Mirror to GroupRow.js
 *   4. Inner button handlers retain their stopPropagation for safety
 *
 * TDD ORDER: this spec is committed in FAILING state in Task 1; Task 2
 * applies the SessionRow.js + GroupRow.js edits.
 */

const APP_ROOT = join(__dirname, '..', '..', '..', 'internal', 'web', 'static', 'app');

test.describe('BUG #17 / UX-06 — action button bubble', () => {
  test('structural: SessionRow.js action span has onMouseDown stopPropagation', () => {
    const src = readFileSync(join(APP_ROOT, 'SessionRow.js'), 'utf-8');
    expect(
      /onMouseDown=\$?\{?\(?\s*e\s*\)?\s*=>\s*e\.stopPropagation/.test(src),
      'SessionRow.js must have onMouseDown={(e) => e.stopPropagation()} on the action span — BUG #17 / UX-06 (load-bearing: catches early mousedown before click)',
    ).toBe(true);
  });

  test('structural: SessionRow.js stopPropagation count is at least 5 (4 inner + 1 span)', () => {
    const src = readFileSync(join(APP_ROOT, 'SessionRow.js'), 'utf-8');
    const count = (src.match(/stopPropagation/g) || []).length;
    expect(
      count,
      `SessionRow.js stopPropagation count must be at least 5 (4 inner button handlers + 1 new span onClick); found ${count}`,
    ).toBeGreaterThanOrEqual(5);
  });

  test('structural: GroupRow.js action span has onMouseDown stopPropagation', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /onMouseDown=\$?\{?\(?\s*e\s*\)?\s*=>\s*e\.stopPropagation/.test(src),
      'GroupRow.js must have onMouseDown={(e) => e.stopPropagation()} on the action span — BUG #17 / UX-06',
    ).toBe(true);
  });

  test('structural: GroupRow.js stopPropagation count is at least 4 (3 inner + 1 span)', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    const count = (src.match(/stopPropagation/g) || []).length;
    expect(
      count,
      `GroupRow.js stopPropagation count must be at least 4 (3 inner button handlers + 1 new span onClick); found ${count}`,
    ).toBeGreaterThanOrEqual(4);
  });

  test('structural preservation: plan 04-05 hidden group-hover:flex still in GroupRow.js', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /hidden group-hover:flex/.test(src),
      'plan 04-05 hidden group-hover:flex must be preserved in GroupRow.js',
    ).toBe(true);
  });

  test('structural preservation: plan 04-06 countVisibleChildren still in GroupRow.js', () => {
    const src = readFileSync(join(APP_ROOT, 'GroupRow.js'), 'utf-8');
    expect(
      /countVisibleChildren/.test(src),
      'plan 04-06 countVisibleChildren must be preserved in GroupRow.js',
    ).toBe(true);
  });

  test('DOM: clicking the delete action button does NOT select the row', async ({ page }) => {
    await page.goto('/?t=test');
    await page.waitForSelector('header', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(500);

    const sessionCount = await page.locator('button[data-session-id]').count();
    test.skip(sessionCount === 0, 'no fixture sessions available — DOM test deferred to Phase 8 fixtures');

    // Pick the first session row.
    const row = page.locator('button[data-session-id]').first();
    const targetId = await row.getAttribute('data-session-id');

    // Hover to reveal the action strip.
    await row.hover();
    await page.waitForTimeout(150);

    // Find the delete button inside the row's action strip.
    const deleteBtn = row.locator('button[aria-label="Delete session"]');
    const deleteCount = await deleteBtn.count();
    test.skip(deleteCount === 0, 'delete button not visible — action strip may be hidden');

    // Capture pre-click selected state.
    const preBorder = await row.evaluate((el) => el.className.includes('border-tn-blue'));

    await deleteBtn.click();
    await page.waitForTimeout(200);

    // The confirm dialog should be visible — that's the expected side effect.
    // We do NOT assert on the dialog presence; we assert on the row state.
    const postBorder = await row.evaluate((el) => el.className.includes('border-tn-blue'));

    expect(
      postBorder,
      `clicking the Delete action button must NOT add the selected border to the row (pre=${preBorder}, post=${postBorder}, id=${targetId}) — BUG #17 / UX-06`,
    ).toBe(preBorder);

    // Cleanup: dismiss the dialog if visible.
    await page.keyboard.press('Escape').catch(() => {});
  });
});
