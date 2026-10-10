import * as distributorsRepo from '../../data/distributors-repo';
import { canFoundDistributor, type Session } from '../../domain/auth/session';
import {
  type DistributorProfilePatch,
  type NewDistributorInput,
  prepareNewDistributor,
  prepareProfilePatch,
} from '../../domain/tenancy/distributor-input';
import { TERMS_VERSION } from '../../domain/legal/versions';
import { EmailNotVerifiedError, InvalidInputError } from '../../domain/tenancy/errors';
import { checkConsent, collectIssues } from '../../domain/tenancy/field-checks';
import { normalizeSlug, type SlugIssue, validateSlug } from '../../domain/tenancy/slug';
import { forgetVisibleDistributors } from './visible-distributors';

/** The sign-up form plus the two declarations the founder must tick (terms §2, PLAN 2.7). */
export interface FoundingInput extends NewDistributorInput {
  /** "Acepto los términos". Only `true` is accepted. */
  acceptTerms: true;
  /**
   * "Declaro que puedo representar a este negocio y que cuenta con las autorizaciones para
   * comercializar GLP". Only `true` is accepted.
   */
  declaresAuthority: true;
}

/**
 * Founds a distributor for the signed-in account (PLAN 2.2) and returns its id. The account
 * becomes its owner and the distributor starts a free trial. The acceptance of the terms and
 * the authority declaration are stored, with server time, in its private settings.
 * Throws `EmailNotVerifiedError`, `InvalidInputError` (per-field issues), `SlugTakenError`,
 * `DistributorLimitError`, `ProfileRequiredError`, `PermissionDeniedError` or `OfflineError`.
 */
export async function foundDistributor(session: Session, input: FoundingInput): Promise<string> {
  if (!canFoundDistributor(session) || session.email === null) throw new EmailNotVerifiedError();
  const prepared = prepareNewDistributor(input);
  const consents = collectIssues([
    ['acceptTerms', checkConsent(input.acceptTerms)],
    ['declaresAuthority', checkConsent(input.declaresAuthority)],
  ]);
  const issues = [...(prepared.ok ? [] : prepared.issues), ...consents];
  if (!prepared.ok || issues.length > 0) throw new InvalidInputError(issues);
  const id = await distributorsRepo.createDistributor({
    founder: { uid: session.uid, email: session.email },
    distributor: prepared.value,
    now: new Date(),
    termsVersion: TERMS_VERSION,
  });
  forgetVisibleDistributors();
  return id;
}

export type SlugCheck =
  | { status: 'invalid'; slug: string; issue: SlugIssue }
  | { status: 'taken'; slug: string }
  | { status: 'available'; slug: string };

/**
 * Live feedback for the link field: normalises what was typed, validates it and asks whether it
 * is free (one read; debounce the calls). The founding transaction has the last word.
 */
export async function checkSlug(raw: string): Promise<SlugCheck> {
  const slug = normalizeSlug(raw);
  const issue = validateSlug(slug);
  if (issue) return { status: 'invalid', slug, issue };
  const isFree = await distributorsRepo.isSlugAvailable(slug);
  return { status: isFree ? 'available' : 'taken', slug };
}

/**
 * Owner edit of the public profile. Throws `InvalidInputError`, or `PermissionDeniedError` when
 * the account is not an owner or the distributor is read-only (suspended, trial over).
 */
export async function editDistributorProfile(
  distributorId: string,
  patch: DistributorProfilePatch,
): Promise<void> {
  const prepared = prepareProfilePatch(patch);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  await distributorsRepo.updateDistributorProfile(distributorId, prepared.value);
  forgetVisibleDistributors();
}

export const getPrivateSettings = distributorsRepo.getDistributorPrivateSettings;
