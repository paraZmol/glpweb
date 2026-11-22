// Quality (testing-strategy §7, perf-a11y-auditor): images and fonts of the public pages.
// - Every image has a text alternative (empty when it only decorates), a reserved size and,
//   below the first view, `loading="lazy"`.
// - No image is downloaded much larger than it is painted (more than 2.5 times the physical
//   pixels of its box): on prepaid data every KB counts.
// - Every @font-face of the build says `font-display: swap`, so the text never waits for a font.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { reportMeasure } from '../support/measure';
import { dismissStorageNotice } from '../support/storage-notice';

const PUBLIC_SCREENS = ['/', '/para-distribuidoras', '/d/gas-demo-norte'] as const;
/** An image may carry this many times the pixels it paints before it counts as oversized. */
const OVERSIZE_FACTOR = 2.5;

test.describe('images', () => {
  test.skip(
    process.env.E2E_EMULATORS !== 'true',
    'The visitor page reads the seeded emulators: run with E2E_EMULATORS=true',
  );

  for (const path of PUBLIC_SCREENS) {
    test(`${path}: alternative, reserved size, lazy loading and size of every image`, async ({
      page,
    }, testInfo) => {
      await dismissStorageNotice(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Lazy images only load when they come near: walk the page so each one is measured.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        window.scrollTo(0, 0);
      });
      const report = await page.evaluate((factor) => {
        const dpr = devicePixelRatio;
        return [...document.images].map((image) => {
          const box = image.getBoundingClientRect();
          const belowFold = box.top + scrollY > innerHeight * 1.5;
          const painted = box.width * dpr * box.height * dpr;
          const natural = image.naturalWidth * image.naturalHeight;
          const reserved =
            (image.getAttribute('width') && image.getAttribute('height')) ||
            (image.parentElement && getComputedStyle(image.parentElement).aspectRatio !== 'auto');
          return {
            name: (image.currentSrc || image.src).split('/').pop() ?? '',
            hasAlt: image.hasAttribute('alt'),
            hasSize: Boolean(reserved) || getComputedStyle(image).position === 'absolute',
            belowFoldNotLazy:
              belowFold &&
              image.loading !== 'lazy' &&
              image.getAttribute('fetchpriority') !== 'high',
            oversize: painted > 0 && natural / painted > factor ? natural / painted : 0,
          };
        });
      }, OVERSIZE_FACTOR);
      reportMeasure(testInfo, 'images', `${path}: ${JSON.stringify(report)}`);
      expect(
        report.filter((image) => !image.hasAlt),
        'images without alt',
      ).toEqual([]);
      expect(
        report.filter((image) => !image.hasSize),
        'images without a reserved size',
      ).toEqual([]);
      expect(
        report.filter((image) => image.belowFoldNotLazy),
        'images below the fold that are not lazy',
      ).toEqual([]);
      expect(
        report.filter((image) => image.oversize > 0),
        'images far larger than painted',
      ).toEqual([]);
    });
  }
});

test.describe('fonts', () => {
  test('every @font-face of the build says font-display: swap', () => {
    const assets = join(`dist-e2e-${process.env.E2E_LANE ?? '0'}`, 'assets');
    const css = readdirSync(assets).filter((file) => file.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    const faces = css.flatMap((file) =>
      [...readFileSync(join(assets, file), 'utf8').matchAll(/@font-face\s*\{[^}]*\}/g)].map(
        (match) => match[0],
      ),
    );
    expect(faces.length, 'fonts declared').toBeGreaterThan(0);
    expect(faces.filter((face) => !/font-display:\s*swap/.test(face))).toEqual([]);
  });
});
