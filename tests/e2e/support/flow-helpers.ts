import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * The person comes back to this screen (another window, another tab, another app): the
 * catalogue and the staff are not followed live, they are read again on return (PLAN §11,
 * 2026-10-15, `useRefreshOnReturn`). Every context of a test is "visible" and none loses the
 * focus, so the return is the `focus` event a real window gets.
 */
export async function comeBack(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

/**
 * Comes back to the screen until `what` holds. Two returns closer than one second count as one
 * (`RETURN_REFRESH_GAP_MS`), so a single return can land inside the gap of the previous one:
 * the return is repeated, the wait is on what the screen shows.
 */
export async function comeBackUntil(page: Page, what: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await comeBack(page);
    await what();
  }).toPass({ intervals: [1_100, 1_500, 2_000] });
}

/** The row of a product on the staff catalogue, by its title ("Balón 10 kg · Marca …"). */
export function catalogRow(page: Page, title: string): Locator {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
}

/** Puts a visitor at `point` for the finder: geolocation granted and set. */
export async function standAt(
  page: Page,
  point: { latitude: number; longitude: number },
): Promise<void> {
  const context = page.context();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(point);
}

/** The card the finder shows for `name`, after a search from where the visitor stands. */
export async function finderCard(page: Page, name: string): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  return page.getByRole('article').filter({ hasText: name });
}

/**
 * Marks the running test as the reproduction of a bug that is still open: it is expected to
 * fail, and turns red the day the bug is fixed so the mark is removed (testing-strategy §2:
 * the test stays). `SHOW_BUGS=true` runs it as a normal test, to see how it fails today.
 */
export function knownBug(reason: string): void {
  test.fail(process.env.SHOW_BUGS !== 'true', reason);
}
