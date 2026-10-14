// Refuses to deploy a build that must never reach the public site (docs/PLAN.md 2.11). Hosting
// runs it as `predeploy`, right after `npm run build`, over the folder it is about to upload.
//
//   node scripts/check-dist.mjs            checks ./dist
//   node scripts/check-dist.mjs <folder>   checks another folder (what the tests do)
//
// It fails when the folder:
//   - is missing, empty or has no index.html (nothing was built);
//   - talks to the Firebase emulators: a build made with VITE_USE_EMULATORS=true keeps the
//     address of the emulators and the demo project in its JavaScript, and would send every
//     visitor to 127.0.0.1. Test builds go to dist-e2e-<lane>, never to dist/;
//   - uses the demo project (`demo-glpweb`) as its Firebase project;
//   - carries the sign-in entry of the browser tests: a build made with VITE_E2E_SIGN_IN=true
//     lets a page open a session without Google's window. It only works against the Auth
//     emulator, but it has no business on the public site;
//   - carries source maps (`*.map` files or `sourceMappingURL` comments): the repository is
//     public, but what is deployed is decided here, not by a build option left on by mistake.
// Exit code 0 when the folder is fit to deploy, 1 otherwise. It never deploys anything itself.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Text files a browser executes or parses; anything else is not scanned for markers. */
const SCANNED_EXTENSIONS = ['.js', '.mjs', '.css', '.html', '.json', '.webmanifest'];

/**
 * Traces an emulator build leaves in its code. `src/data/firebase.ts` connects to the host
 * `127.0.0.1` with the emulator project id; a production build folds the condition away and
 * drops both (checked against a real build of each kind on 2026-10-11: the production bundle
 * holds neither text, the emulator bundle holds both).
 */
const EMULATOR_MARKERS = [
  [/demo-glpweb/, 'names the emulator project "demo-glpweb"'],
  [/127\.0\.0\.1/, 'connects to 127.0.0.1 (Firebase emulators)'],
  [/https?:\/\/localhost:\d/, 'connects to localhost (Firebase emulators)'],
  [/VITE_USE_EMULATORS["']?\s*[:=]\s*["']true["']/, 'was built with VITE_USE_EMULATORS=true'],
];

/**
 * Traces of the test-only sign-in (docs/PLAN.md 2.1): the function `src/features/auth/
 * e2e-entry.ts` hangs on `window` and the marker of `src/data/emulated-google.ts`. Neither file
 * is imported by a production build (checked against a real build of each kind on 2026-10-12:
 * the production bundle holds neither text, the test bundle holds both).
 */
const TEST_ENTRY_MARKERS = [
  [/hornillaE2eSignIn/, 'carries the test-only sign-in entry (window.hornillaE2eSignIn)'],
  [/hornilla-emulated-google-sign-in/, 'carries the emulator-only Google sign-in'],
];

const FORBIDDEN_MARKERS = [...EMULATOR_MARKERS, ...TEST_ENTRY_MARKERS];

const SOURCE_MAP_COMMENT = /[#@]\s*sourceMappingURL=/;

function filesUnder(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function problemsOfFile(path, name) {
  if (name.endsWith('.map')) return [`${name}: source map`];
  if (!SCANNED_EXTENSIONS.some((extension) => name.endsWith(extension))) return [];
  const content = readFileSync(path, 'utf8');
  const found = FORBIDDEN_MARKERS.filter(([pattern]) => pattern.test(content)).map(
    ([, label]) => `${name}: ${label}`,
  );
  if (SOURCE_MAP_COMMENT.test(content)) found.push(`${name}: points at a source map`);
  return found;
}

/** Every reason `folder` must not be deployed; an empty list means it is fit to deploy. */
export function checkDist(folder) {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    return [`${folder}: the folder does not exist (run \`npm run build\` first)`];
  }
  const files = filesUnder(folder);
  if (!files.some((path) => relative(folder, path) === 'index.html')) {
    return [`${folder}: there is no index.html (the build did not finish)`];
  }
  return files.flatMap((path) =>
    problemsOfFile(path, relative(folder, path).replaceAll('\\', '/')),
  );
}

function main(argv) {
  const folder = argv[0] ?? 'dist';
  const problems = checkDist(folder);
  if (problems.length === 0) {
    process.stdout.write(`Deploy check: ${folder} is a production build.\n`);
    return;
  }
  process.stderr.write(
    `\nDEPLOY CHECK — ${folder} must not be deployed (${problems.length} problem(s)):\n\n` +
      problems.map((problem) => `  ✘ ${problem}`).join('\n') +
      '\n\nBuild again with `npm run build` (no VITE_USE_EMULATORS, no VITE_E2E_SIGN_IN) and try again.\n\n',
  );
  process.exitCode = 1;
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) main(process.argv.slice(2));
