import type { Page } from '@playwright/test';

/**
 * Phase 4 / Plan 02 / Task 2: BUG #20 / COSM-02 test helper
 *
 * Provides expandForFullPageScreenshot / collapseAfterFullPageScreenshot
 * for Playwright specs that need to capture the full document height
 * via { fullPage: true }.
 *
 * Why a test-side helper instead of a production CSS change:
 *
 * internal/web/static/styles.src.css line 150 sets body { overflow: hidden }
 * which is intentional production behavior for the chat-style fixed-height
 * app. We do NOT change production CSS. Instead, this helper injects a
 * <style> tag at runtime that overrides overflow: visible !important on
 * the document scroll containers, takes the screenshot, then removes the
 * injected style tag to restore the production cascade.
 *
 * Usage:
 *
 *   import { expandForFullPageScreenshot, collapseAfterFullPageScreenshot }
 *     from './screenshot-helpers.js';
 *
 *   await expandForFullPageScreenshot(page);
 *   const buf = await page.screenshot({ fullPage: true });
 *   await collapseAfterFullPageScreenshot(page);
 *
 * Internally, the expand call attaches a `data-screenshot-helper` style tag
 * to the document head. The collapse call removes any element matching
 * `style[data-screenshot-helper]`. Multiple expand calls without a collapse
 * stack injected style tags; the collapse removes ALL of them so the
 * production state is fully restored.
 */

// NOTE on the #app-root position override:
// internal/web/static/app/main.js line 134 sets
//   root.style.cssText = 'position:fixed;inset:0;z-index:10;'
// as an inline style at boot time. Stylesheet rules with !important DO
// beat non-important inline styles, so the overrides below take effect
// even against the JS-applied inline `position: fixed`. Without the
// position:static override, #app-root stays removed from body flow and
// body.scrollHeight collapses to 0, making `page.screenshot({ fullPage:
// true })` throw "Unable to capture screenshot".
//
// The `.app` selector is kept for forward compatibility with any future
// CSS rule that uses the legacy class name; it is currently unused in
// the v1.3.4 redesign DOM.
const OVERRIDE_CSS = `
  html, body, .app, #app-root {
    overflow: visible !important;
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
  }
  #app-root {
    position: static !important;
    inset: auto !important;
    z-index: auto !important;
  }
`;

const HELPER_MARKER = 'data-screenshot-helper';

/**
 * Inject a <style> tag that overrides body { overflow: hidden } so
 * Playwright's { fullPage: true } captures the entire document height.
 *
 * Idempotent across multiple calls — each call attaches a new style tag
 * marked with data-screenshot-helper. The collapse helper removes ALL of
 * them.
 *
 * After injection, this helper forces a synchronous layout flush and
 * waits one animation frame before returning. The layout flush is
 * load-bearing: without it, an immediate `page.screenshot({ fullPage:
 * true })` can fail with "Protocol error (Page.captureScreenshot):
 * Unable to capture screenshot" because Chromium's fullPage walker
 * races ahead of the style recalc triggered by the injected override.
 * Calling `document.body.getBoundingClientRect()` then awaiting an rAF
 * forces the layout to settle before the helper returns.
 */
export async function expandForFullPageScreenshot(page: Page): Promise<void> {
  await page.addStyleTag({ content: OVERRIDE_CSS });
  // Mark the most recently added style tag with our marker so collapse can
  // find it. addStyleTag returns the ElementHandle for the new <style>.
  // We tag via page.evaluate because addStyleTag's returned handle does not
  // expose a setAttribute method directly in all Playwright versions.
  //
  // We also force a layout flush via getBoundingClientRect and wait one
  // animation frame so Chromium's fullPage walker sees the new document
  // dimensions before the caller's screenshot call.
  await page.evaluate(
    (marker) => {
      const styles = document.head.querySelectorAll('style:not([' + marker + '])');
      if (styles.length > 0) {
        const last = styles[styles.length - 1];
        last.setAttribute(marker, '1');
      }
      // Force layout recalc.
      void document.body.getBoundingClientRect();
      void document.documentElement.getBoundingClientRect();
      // Return a promise that resolves on the next animation frame to
      // give the compositor a chance to apply the style change before
      // the caller's screenshot call.
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    },
    HELPER_MARKER,
  );
}

/**
 * Remove every <style> tag tagged with data-screenshot-helper, restoring
 * the production cascade (body { overflow: hidden }).
 */
export async function collapseAfterFullPageScreenshot(page: Page): Promise<void> {
  await page.evaluate((marker) => {
    const styles = document.head.querySelectorAll('style[' + marker + ']');
    styles.forEach((s) => s.parentNode && s.parentNode.removeChild(s));
  }, HELPER_MARKER);
}

/**
 * Convenience: expand, take a full-page screenshot, collapse. Returns the
 * screenshot buffer. Specs may prefer this over the explicit pair when
 * they only need a single capture.
 */
export async function fullPageScreenshotExpanded(
  page: Page,
  options?: Parameters<Page['screenshot']>[0],
): Promise<Buffer> {
  await expandForFullPageScreenshot(page);
  try {
    return await page.screenshot({ ...(options || {}), fullPage: true });
  } finally {
    await collapseAfterFullPageScreenshot(page);
  }
}
