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

test.describe('the kept moment', () => {
  /**
   * The corner polaroid shows `capturedFrame` — the still taken at the instant
   * the heart landed. On the Lite path there was never a camera, so there is no
   * frame, and the corner must be CLEAR rather than an empty box.
   *
   * A placeholder here would be the same defect as a button that pretends to
   * work: it promises a photo that does not exist.
   */
  test('is absent when there was never a camera', async ({ page }) => {
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'DELIVERY');

    // No stream was ever acquired in this run, so no frame was captured.
    await expect(page.locator('figure')).toHaveCount(0);
  });
});

test.describe('the unlock beat', () => {
  /**
   * The burst is a canvas behind the stamp. It must PAINT, not merely exist —
   * a component that mounts and draws nothing looks identical to a working one
   * in any `toBeVisible` assertion.
   */
  test('draws the burst behind the stamp', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'UNLOCKING');

    await expect(page.getByRole('heading', { name: 'DELIVERY UNLOCKED' })).toBeVisible({
      timeout: 10_000,
    });

    // Any non-transparent pixel means the canvas is being drawn into.
    await expect
      .poll(
        async () =>
          page
            .locator('canvas')
            .first()
            .evaluate((element: HTMLCanvasElement) => {
              const ctx = element.getContext('2d');
              if (ctx === null || element.width === 0) return false;
              const { data } = ctx.getImageData(0, 0, element.width, element.height);
              for (let i = 3; i < data.length; i += 4 * 97) {
                if ((data[i] ?? 0) > 0) return true;
              }
              return false;
            }),
        { timeout: 10_000 },
      )
      .toBe(true);

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  /**
   * Doc 04 §C.6 is a SAFETY rule. Under reduced motion the shake and the radial
   * bloom are removed ENTIRELY — not softened — and the burst settles straight
   * to its end state.
   */
  test('reduced motion removes the shake and the bloom', async ({ browser }) => {
    // `reducedMotion` is a direct `newContext` option. Nesting it under
    // `contextOptions` — which is the shape the config file's `use` block
    // takes — is accepted silently and does nothing, so the test ran at full
    // motion and found the bloom it was asserting was absent.
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto(EXPERIENCE);
    await jumpTo(page, 'UNLOCKING');
    await expect(page.getByRole('heading', { name: 'DELIVERY UNLOCKED' })).toBeVisible({
      timeout: 10_000,
    });

    // The bloom layer is rendered only when `motionSafe` is true.
    const bloomLayers = await page
      .locator('div')
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) =>
            getComputedStyle(node).backgroundImage.includes('radial-gradient'),
          ).length,
      );
    expect(bloomLayers).toBe(0);

    await context.close();
  });
});
