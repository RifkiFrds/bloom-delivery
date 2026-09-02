import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * End-to-end smoke — Doc 05 §12, Phase 9.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────
 * It verifies the invariants that survive without hardware:
 *
 *   · the root path is neutral and does not link on
 *   · the happy path reaches the camera stage
 *   · THE NO-DEAD-END INVARIANT: every failure screen reaches the letter
 *   · the escape hatch is keyboard-reachable from t=0
 *   · nothing throws to the console during a full run
 *
 * It CANNOT verify the camera light going out, the true-positive rate, iOS
 * audio, or in-app browsers. Those are hardware-only facts, and Doc 05 §12 is
 * explicit that "a criterion measured in the simulator is not measured".
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Chromium runs with `--use-fake-device-for-media-stream`, so `getUserMedia`
 * resolves with a synthetic stream and the permission path is exercised for
 * real. The synthetic stream contains no faces, so the run stops at the face
 * stage by design — which is itself the assertion that detection started.
 */

const EXPERIENCE = '/d/e2e-smoke';

/** Fails the test on any console error, so a silent throw cannot pass. */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error: Error) => {
    errors.push(`${error.name}: ${error.message}`);
  });
  return errors;
}

/**
 * Jumps the machine to a state through the debug panel (dev builds only).
 *
 * The panel toggle is a TOGGLE, so this opens it only when the jump controls
 * are not already on screen — a second call would otherwise close the panel and
 * then wait forever for a button it had just hidden.
 */
async function jumpTo(page: Page, state: string): Promise<void> {
  const target = page.getByRole('button', { name: state, exact: true });
  if (!(await target.isVisible())) {
    await page.getByRole('button', { name: /^debug ·/ }).click();
  }
  await target.click();
}

test.describe('the root path is neutral', () => {
  test('reveals nothing and links nowhere', async ({ page }) => {
    await page.goto('/');
    // PRD v2 §Security & Privacy: "must not reveal or link to the experience".
    await expect(page.locator('a')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Bloom Delivery');
  });
});

test.describe('the happy path', () => {
  test('landing → pre-flight → camera stage, with no console errors', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['camera']);
    const errors = trackConsoleErrors(page);

    await page.goto(EXPERIENCE);

    await expect(
      page.getByRole('heading', { name: 'Bloom Delivery', level: 1 }),
    ).toBeVisible();

    // `force` skips Playwright's stability wait. Every primary CTA carries a
    // 1.5 s breathing loop by design (Doc 04 §A.5), so the element is never
    // "stable" and the default actionability check would time out on correct
    // behaviour. Visibility is asserted immediately above.
    await page.getByRole('button', { name: 'Start' }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'Before we start' })).toBeVisible();

    // The privacy promise must appear BEFORE the prompt — it is the only
    // pre-prompt intervention available (Doc 02 §6.4).
    await expect(page.getByText('Your camera stays on your phone.')).toBeVisible();

    await page.getByRole('button', { name: "I'm ready" }).click({ force: true });

    // The camera stage mounts once the fake stream is granted.
    const video = page.locator('video');
    await expect(video).toBeVisible({ timeout: 15_000 });

    // ★ REGRESSION ★ — the preview must carry an actual stream, not just exist.
    // Every Phase A scene mounts its own CameraStage, and the element used to
    // be JSX: the stream attached once, to the FIRST one, so from
    // SEEKING_FACES onward the preview was a blank rectangle. `toBeVisible`
    // passed the whole time, which is why nothing caught it.
    await expect
      .poll(
        async () =>
          video.evaluate(
            (element: HTMLVideoElement) =>
              element.srcObject !== null && element.videoWidth > 0,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  /**
   * The element must SURVIVE the scene change, not be replaced by it. Compared
   * by identity: a re-created element would be a different node even though the
   * selector still matches one.
   */
  test('the same <video> element survives every Phase A scene change', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['camera']);
    await page.goto(EXPERIENCE);

    await page.getByRole('button', { name: 'Start' }).click({ force: true });
    await page.getByRole('button', { name: "I'm ready" }).click({ force: true });
    await expect(page.locator('video')).toBeVisible({ timeout: 15_000 });

    // Tag the live element, then walk forward through the camera-bearing states.
    await page.locator('video').evaluate((element) => {
      element.dataset.identity = 'original';
    });

    for (const state of ['SEEKING_FACES', 'TOGETHER_CONFIRMED', 'SEEKING_GESTURE']) {
      await jumpTo(page, state);
      await expect(page.locator('video')).toHaveAttribute('data-identity', 'original');
      await expect
        .poll(async () =>
          page
            .locator('video')
            .evaluate((element: HTMLVideoElement) => element.srcObject !== null),
        )
        .toBe(true);
    }
  });

  test('the motion toggle is a real radio group', async ({ page }) => {
    await page.goto(EXPERIENCE);
    await page.getByRole('button', { name: 'Start' }).click({ force: true });

    const group = page.getByRole('radiogroup', { name: 'Motion' });
    await expect(group).toBeVisible();

    // Asserted by TOGGLING rather than by initial value: the reduced-motion
    // project starts with "Reduced" already selected, because the toggle
    // reflects the OS preference until the user overrides it (Doc 04 §B.3).
    const full = group.getByRole('radio', { name: 'Full' });
    const reduced = group.getByRole('radio', { name: 'Reduced' });

    await reduced.click();
    await expect(reduced).toHaveAttribute('aria-checked', 'true');
    await expect(full).toHaveAttribute('aria-checked', 'false');

    await full.click();
    await expect(full).toHaveAttribute('aria-checked', 'true');
    await expect(reduced).toHaveAttribute('aria-checked', 'false');
  });
});

/**
 * ★ THE NO-DEAD-END INVARIANT ★ — Doc 01 §9.1.
 *
 * "Every failure state has a path to the letter. There is no dead end in this
 * application." Six routes, each asserted independently.
 */
test.describe('every failure state reaches the letter', () => {
  /**
   * Five of the six escapes route THROUGH `UNLOCKING`, so the Lite path shares
   * one teardown-and-transition implementation with the camera path — there is
   * one road to the gift.
   *
   * `FATAL_ERROR` is the exception, and deliberately so: the tree that would
   * play the sequence is the tree that just threw, so it goes straight to
   * `LETTER_OPEN` (Doc 02 §5).
   */
  const viaUnlocking: readonly [string, string][] = [
    ['BLOCKED_ENVIRONMENT', 'Just show me the flowers'],
    ['CAMERA_DENIED', 'Just show me the flowers'],
    ['CAMERA_ERROR', 'Open your delivery'],
    ['CAMERA_INTERRUPTED', 'Just show me the flowers'],
    ['SOLO_PROMPT', 'Peek alone'],
  ];

  for (const [state, label] of viaUnlocking) {
    test(`${state} → unlock → the letter`, async ({ page }) => {
      await page.goto(EXPERIENCE);
      await jumpTo(page, state);

      await page.getByRole('button', { name: label }).first().click();

      // `getByRole`, not `getByText`: the assertive live region also carries
      // the words "Delivery unlocked!" and a text match finds both.
      await expect(page.getByRole('heading', { name: 'DELIVERY UNLOCKED' })).toBeVisible({
        timeout: 10_000,
      });
    });
  }

  test('FATAL_ERROR → the letter, directly', async ({ page }) => {
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'FATAL_ERROR');

    await page.getByRole('button', { name: 'Take me to the letter' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('accessibility invariants', () => {
  test('the escape hatch is keyboard-reachable from t=0', async ({ page }) => {
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'SEEKING_GESTURE');

    // Visually hidden below mercy level 2, but present in the DOM and focusable
    // — the provision that satisfies WCAG 2.5.4 (Doc 04 §F.3).
    const hatch = page.getByRole('button', { name: /Let them out/ });
    await expect(hatch).toBeAttached();
    await hatch.focus();
    await expect(hatch).toBeFocused();
  });

  test('both live regions exist before anything is announced', async ({ page }) => {
    await page.goto(EXPERIENCE);
    // A live region created at the moment of the announcement is not reliably
    // read by any screen reader, so both are always present (Doc 04 §F.4).
    await expect(page.locator('#sr-status')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#sr-alert')).toHaveAttribute('aria-live', 'assertive');
  });

  test('the letter is real, selectable text — never an image', async ({ page }) => {
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'LETTER_OPEN');

    const article = page.getByRole('article');
    await expect(article).toBeVisible();
    await expect(article.locator('img, canvas')).toHaveCount(0);
    await expect(article.locator('p').first()).not.toBeEmpty();
  });

  test('the letter does not scroll the page horizontally at 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(EXPERIENCE);
    await jumpTo(page, 'LETTER_OPEN');
    await expect(page.getByRole('article')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
