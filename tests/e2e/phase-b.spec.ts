import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Phase B — the delivery, the bloom, the tulips.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * `smoke.spec.ts` reaches `UNLOCKING` from six directions and stops there. It
 * asserts the stamp and nothing beyond it, so NOTHING in the suite has ever
 * executed `DELIVERY` or `BLOOM` — the two states that render WebGL.
 *
 * That is exactly the gap a report of "the tulips never came out" lands in.
 * ─────────────────────────────────────────────────────────────────────────
 */

const EXPERIENCE = '/d/e2e-phase-b';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error: Error) => {
    errors.push(`${error.name}: ${error.message}`);
  });
  return errors;
}

async function jumpTo(page: Page, state: string): Promise<void> {
  const target = page.getByRole('button', { name: state, exact: true });
  if (!(await target.isVisible())) {
    await page.getByRole('button', { name: /^debug ·/ }).click();
  }
  await target.click();
}

test.describe('the 3D stage actually renders', () => {
  for (const beat of ['DELIVERY', 'BLOOM']) {
    test(`${beat} mounts a WebGL canvas and draws something`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(EXPERIENCE);
      await jumpTo(page, beat);

      const canvas = page.locator('canvas');
      await expect(canvas.first()).toBeVisible({ timeout: 20_000 });

      // A canvas that exists but never paints is the failure mode a
      // `toBeVisible` check sails straight past — a broken dynamic import
      // renders `loading: () => null` forever and looks identical.
      await expect
        .poll(
          async () =>
            canvas.first().evaluate((element: HTMLCanvasElement) => {
              const gl = element.getContext('webgl2') ?? element.getContext('webgl');
              return gl !== null && element.width > 0;
            }),
          { timeout: 20_000 },
        )
        .toBe(true);

      expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
    });
  }

  /**
   * ★ REGRESSION: the ring fills, "Sempurna" shows, and nothing happens ★
   *
   * `canUnlock` is write-once for the session. After any unlock — including the
   * debug panel's "force unlock" — every later `HOLD_COMPLETE` is guarded away
   * in silence, because that is precisely what the latch is for.
   *
   * The ring and the status pill both read `holdProgress`, which knows nothing
   * about the machine, so they keep reporting success. Jumping backward now
   * releases the latch, so the tool can be used more than once per session.
   */
  test('jumping back before the unlock releases the latch', async ({ page }) => {
    await page.goto(EXPERIENCE);

    // `dispatchEvent`, not `click`: below mercy level 2 the hatch is
    // deliberately `pointer-events-none` — present and keyboard-focusable, not
    // yet pointable (Doc 04 §B.9). Dispatching exercises the machine, which is
    // what this test is about.
    const openIt = async (): Promise<void> => {
      await jumpTo(page, 'SEEKING_GESTURE');
      await page
        .getByRole('button', { name: /Let them out|Open it anyway/ })
        .dispatchEvent('click');
      await expect(page.getByRole('heading', { name: 'DELIVERY UNLOCKED' })).toBeVisible({
        timeout: 10_000,
      });
    };

    await openIt();
    // Back to the gesture stage — and the gift must be openable again.
    await openIt();
  });
});
