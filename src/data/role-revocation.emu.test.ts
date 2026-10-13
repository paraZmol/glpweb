// Security audit at the close of phase 2 (B3) — what an account keeps once its platform admin
// role is taken away with scripts/grant-platform-admin.mjs --revoke, run here the way a person
// runs it. These tests write down what the EMULATORS do; the one marked MEASURED is a
// measurement, not a wish: it documents the window the script and docs/PLAN.md §9 describe.
import { execFile } from 'node:child_process';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { renewSession, signInAs } from '../../tests/support/emulated-session';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { paths } from './paths';
import {
  getListingReview,
  isPlatformAdmin,
  type ListingReview,
  listDistributors,
  returnListingToReview,
  watchListingReview,
} from './platform-repo';

const { a: A, e: PENDING } = SEED_DISTRIBUTORS;
const ADMIN = SEED_USERS.admin;
const EDITED_ADDRESS = 'Av. Ensayo 704';
const ports = emulatorPorts();

/** Runs the script with `node`, against the emulators of this lane only. */
function grantScript(...args: string[]): Promise<string> {
  const env = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
    FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
  };
  const argv = ['scripts/grant-platform-admin.mjs', '--project', EMULATOR_PROJECT_ID, ...args];
  return new Promise((resolve, reject) => {
    execFile(process.execPath, argv, { env }, (error, stdout, stderr) =>
      error ? reject(new Error(stderr || error.message)) : resolve(stdout),
    );
  });
}

/** What the owner of the listing does meanwhile, written past the rules. */
async function ownerMovesAddress(d: string, addressLine: string): Promise<void> {
  const env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: ports.firestore },
  });
  try {
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), paths.distributor(d)), { addressLine }),
    );
  } finally {
    await env.cleanup();
  }
}

const reviews: (ListingReview | null)[] = [];
const failures: unknown[] = [];
let stopWatching = () => {};

beforeAll(async () => {
  await seedEmulators();
  await signInAs(ADMIN);
  stopWatching = watchListingReview(
    PENDING.id,
    (review) => reviews.push(review),
    (error) => failures.push(error),
  );
  await vi.waitFor(() => expect(reviews.at(-1)?.distributorId).toBe(PENDING.id));

  await grantScript('--uid', ADMIN.uid, '--revoke');
});

afterAll(async () => {
  stopWatching();
  await signOutSession();
  // The other files seed again, but none of them should depend on that.
  await grantScript('--uid', ADMIN.uid);
});

describe('an account that lost the platform admin role', () => {
  it('is told by the script what stays open', async () => {
    await grantScript('--uid', ADMIN.uid);

    const output = await grantScript('--uid', ADMIN.uid, '--revoke');

    expect(output).toContain(`Revoked platform admin for ${ADMIN.uid}`);
    expect(output).toContain('keeps showing that listing');
  });

  it('is refused every new request at once, with the session it already had', async () => {
    expect(await isPlatformAdmin(ADMIN.uid)).toBe(false);
    await expect(getListingReview(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listDistributors({ filter: 'inReview' })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(returnListingToReview(A.id, 'Sin rol.')).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('cannot start the review listener again', async () => {
    const errors: unknown[] = [];
    const stop = watchListingReview(
      A.id,
      () => {},
      (error) => errors.push(error),
    );

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    stop();

    expect(errors[0]).toBeInstanceOf(PermissionDeniedError);
  });

  // MEASURED 2026-10-12 against the emulator. Losing the role does not close a listener that was
  // already open: nothing tells it, and what it had delivered stays on the screen. But it
  // delivers nothing more: the rules are evaluated again for the first change of a document it
  // listens to, and that change ends it with a refusal instead of reaching the account.
  // If this test starts failing, update the header of scripts/grant-platform-admin.mjs,
  // PLAN §9 and the firebase-tenancy skill §10.
  it('MEASURED: the listener it had open stays silent, and the next change ends it', async () => {
    const reported = reviews.length;
    expect(failures).toEqual([]);

    await ownerMovesAddress(PENDING.id, EDITED_ADDRESS);

    await vi.waitFor(() => expect(failures).toHaveLength(1), { timeout: 15_000 });
    expect(failures[0]).toBeInstanceOf(PermissionDeniedError);
    expect(reviews).toHaveLength(reported);
    expect(reviews.map((review) => review?.profile.addressLine)).not.toContain(EDITED_ADDRESS);
  });

  // Last on purpose: it ends the session the tests above use.
  it('loses the session when it tries to renew it: its refresh tokens were revoked', async () => {
    await expect(renewSession()).rejects.toThrow();
  });
});
