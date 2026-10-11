// PLAN 2.11: the check Hosting runs before every deploy. A build that talks to the emulators,
// or that carries source maps, must never reach the public site.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDist } from '../../scripts/check-dist.mjs';

const INDEX = '<!doctype html><script type="module" src="/assets/index-abc.js"></script>';
const PRODUCTION_BUNDLE =
  'const cfg={projectId:"glpweb-app",authDomain:"glpweb-app.firebaseapp.com"};export{cfg};';

let folder: string;

function write(name: string, content: string) {
  const path = join(folder, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A folder that looks like `npm run build` left it. */
function productionBuild() {
  write('index.html', INDEX);
  write('assets/index-abc.js', PRODUCTION_BUNDLE);
  write('assets/index-abc.css', '.a{color:red}');
  write('manifest.webmanifest', '{"name":"Hornilla"}');
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'hornilla-dist-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('checkDist', () => {
  it('accepts a production build', () => {
    productionBuild();

    expect(checkDist(folder)).toEqual([]);
  });

  it.each([
    [
      'names the emulator project',
      'initializeApp({projectId:"demo-glpweb"})',
      'emulator project "demo-glpweb"',
    ],
    [
      'connects Auth to the emulator',
      'connectAuthEmulator(a,"http://127.0.0.1:9109",{disableWarnings:!0})',
      '127.0.0.1',
    ],
    ['connects to an emulator on localhost', 'fetch("http://localhost:8080/v1")', 'localhost'],
    [
      'kept the switch of the emulators on',
      'const env={VITE_USE_EMULATORS:"true"};',
      'VITE_USE_EMULATORS=true',
    ],
  ])('refuses a build that %s', (_case, code, mention) => {
    productionBuild();
    write('assets/firebase-xyz.js', `${PRODUCTION_BUNDLE}${code}`);

    const problems = checkDist(folder);

    expect(problems.join('\n')).toContain(mention);
    expect(problems.every((problem) => problem.startsWith('assets/firebase-xyz.js'))).toBe(true);
  });

  it('refuses a build with source map files', () => {
    productionBuild();
    write('assets/index-abc.js.map', '{"version":3}');

    expect(checkDist(folder)).toEqual(['assets/index-abc.js.map: source map']);
  });

  it.each([
    [
      'JavaScript',
      'assets/index-abc.js',
      `${PRODUCTION_BUNDLE}\n//# sourceMappingURL=index-abc.js.map`,
    ],
    [
      'a style sheet',
      'assets/index-abc.css',
      '.a{color:red}\n/*# sourceMappingURL=index-abc.css.map */',
    ],
  ])('refuses %s that points at a source map', (_case, name, content) => {
    productionBuild();
    write(name, content);

    expect(checkDist(folder)).toEqual([`${name}: points at a source map`]);
  });

  it('reports every problem of the folder at once', () => {
    productionBuild();
    write('assets/a.js', 'connectFirestoreEmulator(db,"http://127.0.0.1:8090")');
    write('assets/a.js.map', '{}');

    expect(checkDist(folder)).toHaveLength(2);
  });

  it('does not mistake an image or a font for code', () => {
    productionBuild();
    write('assets/photo.webp', 'demo-glpweb http://127.0.0.1:9099');

    expect(checkDist(folder)).toEqual([]);
  });

  it.each([
    ['a folder that does not exist', () => join(folder, 'missing')],
    ['an empty folder', () => folder],
  ])('refuses %s: nothing was built', (_case, target) => {
    expect(checkDist(target())).toHaveLength(1);
  });
});

describe('scripts/check-dist.mjs, as Hosting runs it before a deploy', () => {
  const run = (target: string) =>
    execFileSync(process.execPath, ['scripts/check-dist.mjs', target], {
      encoding: 'utf8',
      stdio: 'pipe',
    });

  it('exits with 0 for a production build', () => {
    productionBuild();

    expect(run(folder)).toContain('is a production build');
  });

  it('exits with 1 and says why for a build that talks to the emulators', () => {
    productionBuild();
    write('assets/firebase-xyz.js', 'connectAuthEmulator(a,"http://127.0.0.1:9109")');

    expect(() => run(folder)).toThrow(/must not be deployed[\s\S]*127\.0\.0\.1/);
  });
});
