// Motion of the public pages (docs/marketing/movimiento-portada.md, "Comprobaciones"): the
// sections that arrive on scroll all end visible, nothing starts hidden with reduced motion, and
// the first view never waits for the motion code. Runs at 390 px and 1440 px (both projects).
import { expect, type Page, test } from '@playwright/test';

const PAGES = [
  { path: '/', firstView: 'Usar mi ubicación' },
  { path: '/para-distribuidoras', firstView: 'Registrar mi distribuidora' },
];

/** Elements of the page that motion left (or still keeps) faded or moved, with their text. */
function unsettled(page: Page) {
  return page.locator('main').evaluate((main) => {
    const isIdentity = (value: string) =>
      value === 'none' || value === 'matrix(1, 0, 0, 1, 0, 0)' || value === 'scale(1)';
    const animated = [...main.querySelectorAll<HTMLElement>('[style]')].filter((element) =>
      /opacity|transform/.test(element.getAttribute('style') ?? ''),
    );
    const moved = animated.filter((element) => {
      const style = getComputedStyle(element);
      return style.opacity !== '1' || !isIdentity(style.transform);
    });
    const bands = [...main.querySelectorAll('.highlight-draw')].filter(
      (element) => !isIdentity(getComputedStyle(element, '::before').transform),
    );
    return [...moved, ...bands].map((element) => element.textContent?.slice(0, 40) ?? '');
  });
}

/** Scrolls down a screen at a time, like a person, until the footer is on screen. */
async function scrollToFooter(page: Page) {
  const footer = page.getByRole('contentinfo');
  for (let step = 0; step < 40; step += 1) {
    if (await footer.evaluate((element) => element.getBoundingClientRect().top < innerHeight)) {
      break;
    }
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(80);
  }
  await expect(footer).toBeInViewport();
}

for (const { path, firstView } of PAGES) {
  test(`${path}: every section is visible after scrolling to the footer`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scrollToFooter(page);
    await expect.poll(() => unsettled(page)).toEqual([]);
  });

  test(`${path}: with reduced motion nothing starts hidden`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // At the top, before any scroll: the sections below are already in place.
    expect(await unsettled(page)).toEqual([]);
    await scrollToFooter(page);
    expect(await unsettled(page)).toEqual([]);
  });

  test(`${path}: with slow scripts the first view shows at once, fully opaque`, async ({
    page,
  }) => {
    await page.route('**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.goto(path);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    // Checked on the first frame the page paints: no fade on the headline nor its main action.
    const targets = [heading, page.getByRole('main').getByText(firstView).first()];
    for (const target of targets) {
      const opacity = await target.evaluate((element) => {
        let value = 1;
        for (let node: Element | null = element; node; node = node.parentElement) {
          value *= Number(getComputedStyle(node).opacity);
        }
        return value;
      });
      expect(opacity).toBe(1);
    }
  });
}
