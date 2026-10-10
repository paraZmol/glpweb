// Capturas de la propuesta B "Cocina de casa".
// Uso (desde la raiz del repo): node docs/design/propuestas/b-cocina-de-casa/capturas.mjs [pantalla ...]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'capturas');
mkdirSync(out, { recursive: true });

const pantallas = ['index', 'inicio', 'portada', 'distribuidora', 'seguimiento', 'monitor', 'repartidor'];
const tamanos = { movil: { width: 390, height: 844 }, escritorio: { width: 1440, height: 900 } };
const temas = ['claro', 'oscuro'];
// variantes con otro color de marca (rocoto vivo, tinta oscura, ambar claro)
const alternas = [
  { pantalla: 'distribuidora', marca: 'e11d48', nombre: 'rocoto' },
  { pantalla: 'distribuidora', marca: '1f2937', nombre: 'tinta' },
  { pantalla: 'distribuidora', marca: 'f59e0b', nombre: 'ambar' },
  { pantalla: 'inicio', marca: 'e11d48', nombre: 'rocoto' },
  { pantalla: 'seguimiento', marca: '0e8f6b', nombre: 'verde' },
];

const filtro = process.argv.slice(2);
const quiere = (p) => filtro.length === 0 || filtro.includes(p);

const browser = await chromium.launch();
async function capturar(pantalla, tam, tema, marca, sufijo = '') {
  const ctx = await browser.newContext({ viewport: tamanos[tam], deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const url = pathToFileURL(join(here, `${pantalla}.html`));
  url.searchParams.set('tema', tema);
  if (marca) url.searchParams.set('marca', marca);
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // los elementos fijos (barra inferior, barra "Pedir") deben quedar al pie de la pagina completa
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  if (alto > tamanos[tam].height) await page.setViewportSize({ width: tamanos[tam].width, height: alto });
  await page.waitForTimeout(300);
  const archivo = `${pantalla}-${tam}-${tema}${sufijo}.png`;
  await page.screenshot({ path: join(out, archivo), fullPage: true });
  await ctx.close();
  console.log('ok', archivo);
}

for (const p of pantallas.filter(quiere))
  for (const tam of Object.keys(tamanos)) for (const tema of temas) await capturar(p, tam, tema);
for (const a of alternas.filter((a) => quiere(a.pantalla)))
  for (const tam of Object.keys(tamanos)) {
    await capturar(a.pantalla, tam, 'claro', a.marca, `-marca-${a.nombre}`);
    if (a.nombre !== 'verde') await capturar(a.pantalla, tam, 'oscuro', a.marca, `-marca-${a.nombre}`);
  }
await browser.close();
