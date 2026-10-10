// Screenshots of the "Llama azul" mockups. Run from the repo root:
//   node docs/design/propuestas/a-llama-azul/capturas.mjs [filter]
// Opens each HTML through file://, waits for fonts, saves full-page PNGs in capturas/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'capturas');
mkdirSync(out, { recursive: true });

const pages = ['index', '0-inicio', '1-duenos', '2-distribuidora', '3-seguimiento', '4-monitor', '5-repartidor'];
const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const themes = ['oscuro', 'claro'];
// Alternate brand colors (vivid, light, dark) to prove any distributor color works.
const brandShots = [
  { page: '2-distribuidora', marca: 'E11D48', tema: 'oscuro' },
  { page: '2-distribuidora', marca: 'F59E0B', tema: 'claro' },
  { page: '2-distribuidora', marca: '1F2937', tema: 'oscuro' },
  { page: '0-inicio', marca: 'E11D48', tema: 'oscuro' },
  { page: '3-seguimiento', marca: 'E11D48', tema: 'claro' },
];

const shots = [];
for (const page of pages) for (const tema of themes) shots.push({ page, tema });
shots.push(...brandShots);

const filter = process.argv[2];
const browser = await chromium.launch();
for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
    reducedMotion: 'reduce',
    locale: 'es-PE',
  });
  for (const shot of shots) {
    const name = `${shot.page}-${viewport.name}-${shot.tema}${shot.marca ? '-marca-' + shot.marca : ''}`;
    if (filter && !name.includes(filter)) continue;
    const page = await context.newPage();
    const url = new URL(pathToFileURL(join(here, `${shot.page}.html`)));
    url.searchParams.set('tema', shot.tema);
    if (shot.marca) url.searchParams.set('marca', shot.marca);
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    // Grow the viewport to the document height so fixed bars sit at the real bottom of the page.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (height > viewport.height) {
      await page.setViewportSize({ width: viewport.width, height });
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    await page.close();
    console.log('ok', name);
  }
  await context.close();
}
await browser.close();
