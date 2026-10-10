// Captures for design direction C "En ruta".
// Usage (from the repo root): node docs/design/propuestas/c-en-ruta/capturas.mjs [filter]
// Opens every mockup through file://, waits for fonts, and saves full-page PNGs into ./capturas.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'capturas');
mkdirSync(out, { recursive: true });

const SCREENS = ['0-inicio', '1-duenos', '2-distribuidora', '3-seguimiento', '4-monitor', '5-repartidor'];
const VIEWPORTS = [
  { key: '390', width: 390, height: 844, mobile: true },
  { key: '1440', width: 1440, height: 900, mobile: false },
];
const THEMES = ['claro', 'oscuro'];
// Alternate brand colours: one that collides with the signal yellow, one almost black.
const ALT_BRANDS = [
  { screen: '2-distribuidora', brand: 'F59E0B', theme: 'claro' },
  { screen: '2-distribuidora', brand: '1F2937', theme: 'oscuro' },
  { screen: '2-distribuidora', brand: '0F766E', theme: 'claro' },
  { screen: '0-inicio', brand: 'F59E0B', theme: 'claro' },
  { screen: '0-inicio', brand: '0F766E', theme: 'oscuro' },
  { screen: '3-seguimiento', brand: 'F59E0B', theme: 'claro' },
];

const jobs = [];
for (const screen of SCREENS) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) jobs.push({ screen, viewport, theme });
  }
}
for (const alt of ALT_BRANDS) {
  for (const viewport of VIEWPORTS) jobs.push({ ...alt, viewport });
}
jobs.push({ screen: 'index', viewport: VIEWPORTS[1], theme: 'claro' });

const filter = process.argv[2];
const browser = await chromium.launch();
let count = 0;
for (const job of jobs) {
  const name =
    `${job.screen}-${job.viewport.key}-${job.theme}` + (job.brand ? `-marca-${job.brand}` : '');
  if (filter && !name.includes(filter)) continue;
  const context = await browser.newContext({
    viewport: { width: job.viewport.width, height: job.viewport.height },
    deviceScaleFactor: job.viewport.mobile ? 2 : 1,
    isMobile: job.viewport.mobile,
    hasTouch: job.viewport.mobile,
    reducedMotion: 'reduce',
    locale: 'es-PE',
  });
  const page = await context.newPage();
  const url = new URL(pathToFileURL(join(here, `${job.screen}.html`)).href);
  url.searchParams.set('tema', job.theme);
  if (job.brand) url.searchParams.set('marca', job.brand);
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Chromium does not render off-screen iframes (the phone previews): scroll through the page once.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(job.screen === '1-duenos' ? 1200 : 300);
  // Map screens (3, 4, 5) fill exactly one desktop viewport. Everything else is captured by
  // growing the viewport to the document height (not fullPage): fixed bars are drawn once at
  // the bottom and off-screen iframes get painted.
  const fitsViewport = !job.viewport.mobile && /^[345]-/.test(job.screen);
  if (!fitsViewport) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (height > job.viewport.height) {
      await page.setViewportSize({ width: job.viewport.width, height });
      await page.waitForTimeout(job.screen === '1-duenos' ? 1200 : 300);
    }
  }
  await page.screenshot({ path: join(out, `${name}.png`) });
  await context.close();
  count += 1;
  process.stdout.write(`ok ${name}.png\n`);
}
await browser.close();
process.stdout.write(`${count} capture(s) in ${out}\n`);
