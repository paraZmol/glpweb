// Renders one JPEG per comparison row into comparacion/. Run from the repo root:
//   node docs/design/propuestas/comparar.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'comparacion');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, colorScheme: 'light' });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
const missing = [];
for (const section of await page.locator('section').all()) {
  const id = await section.getAttribute('id');
  await section.scrollIntoViewIfNeeded();
  for (const img of await section.locator('img').all()) {
    const ok = await img.evaluate((el) => el.decode().then(() => el.naturalWidth > 0).catch(() => false));
    if (!ok) missing.push(await img.getAttribute('src'));
  }
  await section.screenshot({ path: join(out, `${id}.jpg`), type: 'jpeg', quality: 80 });
}
await browser.close();
process.stdout.write(missing.length ? `MISSING:\n${missing.join('\n')}\n` : 'All comparison rows rendered.\n');
