// PLAN 2.11: what Hosting is told to do before and while it serves the app. A deploy is only
// ever started by a person; these tests keep its configuration from drifting.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Header {
  key: string;
  value: string;
}

const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
  hosting: {
    public: string;
    predeploy: string[];
    headers: { source: string; headers: Header[] }[];
  };
};
const everywhere = config.hosting.headers.find((entry) => entry.source === '**')?.headers ?? [];
const headerOf = (key: string) => everywhere.find((header) => header.key === key)?.value;

describe('firebase.json — hosting', () => {
  it('deploys dist/, and only after building production and checking that folder', () => {
    expect(config.hosting.public).toBe('dist');
    expect(config.hosting.predeploy).toEqual(['npm run build', 'node scripts/check-dist.mjs dist']);
  });

  it('never deploys the folder of a test build', () => {
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain('dist-e2e-${lane}');
    expect(readFileSync('.gitignore', 'utf8')).toContain('dist-e2e-*/');
  });

  // Report-only until it is tried with the Google sign-in on a preview channel (PLAN 2.11).
  it('sends the Content-Security-Policy as report-only, not yet enforced', () => {
    expect(headerOf('Content-Security-Policy')).toBeUndefined();
    expect(headerOf('Content-Security-Policy-Report-Only')).toBeDefined();
  });

  it.each([
    "default-src 'none'",
    "script-src 'self' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
    'frame-src https://glpweb-app.firebaseapp.com',
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ])('the policy carries the directive "%s"', (directive) => {
    const directives = (headerOf('Content-Security-Policy-Report-Only') ?? '')
      .split(';')
      .map((part) => part.trim());

    expect(directives).toContain(directive);
  });

  it('allows no inline or evaluated script, and no script from anywhere else', () => {
    const policy = headerOf('Content-Security-Policy-Report-Only') ?? '';
    const scripts = policy.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';

    expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval|\*|data:|blob:/);
  });

  // PLAN 2.1: Google is the only way in, so a policy that forgets what its window needs would
  // lock everybody out the day it is enforced. The window is opened by a script of Google and
  // answers through a hidden frame of the auth domain the app is configured with.
  it('lets the Google sign-in work: its script, the frame of the auth domain, the two services', () => {
    const policy = headerOf('Content-Security-Policy-Report-Only') ?? '';
    const directive = (name: string) =>
      policy
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `)) ?? '';
    const [, authDomain = ''] =
      /authDomain: '([^']+)'/.exec(readFileSync('src/data/firebase-config.ts', 'utf8')) ?? [];

    expect(authDomain).not.toBe('');
    expect(directive('frame-src').split(' ')).toContain(`https://${authDomain}`);
    expect(directive('script-src').split(' ')).toContain('https://apis.google.com');
    expect(directive('connect-src').split(' ')).toEqual(
      expect.arrayContaining([
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
      ]),
    );
  });

  it('keeps the headers that were already there', () => {
    expect(headerOf('X-Content-Type-Options')).toBe('nosniff');
    expect(headerOf('X-Frame-Options')).toBe('DENY');
    expect(headerOf('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
