// Blocks personal or secret data from reaching the public repository.
// Usage: node scripts/check-public.mjs            → scans every tracked file (CI, npm run check)
//        node scripts/check-public.mjs --staged   → scans what is about to be committed (git hook)
// A line may opt out with the marker `public-ok` plus a reason, reviewed by the publish-guard agent.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const stagedOnly = process.argv.includes('--staged');
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const IGNORED_PATHS = [
  /^package-lock\.json$/,
  /^skills-lock\.json$/,
  /^\.claude\/skills\/(firebase-|firestore-|shadcn\/)/, // third-party skills, reviewed on install
  /^scripts\/check-public\.mjs$/,
  /\.(png|jpe?g|webp|gif|ico|woff2?)$/i,
];

const FORBIDDEN_FILES = [
  [/(^|\/)\.env(\.|$)(?!example)/, 'environment file'],
  [/credencial|credential/i, 'credentials file'],
  [/service[-_]?account.*\.json$/i, 'service account key'],
  [/(^|\/)google-services\.json$|GoogleService-Info\.plist$/, 'mobile Firebase config'],
  [/\.(pem|key|p12|pfx|jks|keystore)$/i, 'private key or keystore'],
  [/(^|\/)(firebase|firestore|database|ui)-debug\.log$/, 'emulator debug log'],
  [/\.(sqlite|db|sql|csv|xlsx?)$/i, 'data dump'],
];

const ALLOWED_EMAIL =
  /@(example\.(com|org)|users\.noreply\.github\.com|[a-z0-9-]+\.test|anthropic\.com)$/i;
const FAKE_PHONE = /^9000000\d{2}$/; // convention for seed and test data

const CONTENT_RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/"type"\s*:\s*"service_account"/, 'service account JSON'],
  [/\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API secret key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\b1\/\/[0-9A-Za-z_-]{30,}/, 'Google refresh token'],
  [/\b(password|passwd|contraseña|clave)\s*[:=]\s*['"][^'"\s]{4,}['"]/i, 'hard-coded password'],
  [/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+|\/Users\/[a-z0-9._-]+\//i, 'local user path'],
];

function findEmails(line) {
  return (line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).filter(
    (email) => !ALLOWED_EMAIL.test(email),
  );
}

function findPhones(line) {
  return (line.match(/(?<![\d.])9\d{8}(?![\d.])/g) ?? []).filter(
    (phone) => !FAKE_PHONE.test(phone),
  );
}

const files = (
  stagedOnly ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR') : git('ls-files')
)
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const problems = [];

for (const file of files) {
  for (const [pattern, label] of FORBIDDEN_FILES) {
    if (pattern.test(file)) problems.push(`${file}: forbidden file (${label})`);
  }
  if (IGNORED_PATHS.some((pattern) => pattern.test(file))) continue;

  let content;
  try {
    content = stagedOnly ? git('show', `:${file}`) : readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }

  content.split('\n').forEach((line, index) => {
    if (line.includes('public-ok')) return;
    const at = `${file}:${index + 1}`;
    for (const [pattern, label] of CONTENT_RULES) {
      if (pattern.test(line)) problems.push(`${at}: ${label}`);
    }
    for (const email of findEmails(line)) problems.push(`${at}: e-mail address ${email}`);
    for (const phone of findPhones(line)) problems.push(`${at}: phone number ${phone}`);
  });
}

if (problems.length > 0) {
  process.stderr.write(
    `\nPUBLIC REPO GUARD — ${problems.length} problem(s). Nothing was committed.\n\n` +
      problems.map((problem) => `  ✘ ${problem}`).join('\n') +
      '\n\nRemove the data, or if it is intentionally public add `public-ok: <reason>` on that line.\n\n',
  );
  process.exit(1);
}

process.stdout.write(`Public repo guard: ${files.length} file(s) clean.\n`);
