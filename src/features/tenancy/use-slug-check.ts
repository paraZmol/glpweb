import { useEffect, useState } from 'react';
import { normalizeSlug, validateSlug } from '../../domain/tenancy/slug';
import { checkSlug, type SlugCheck } from './tenancy-actions';

/** Wait after the last keystroke before asking the server (one read per pause, not per key). */
export const SLUG_CHECK_DELAY_MS = 500;

export type SlugAvailability =
  /** Nothing typed yet. */
  | { status: 'empty' }
  | { status: 'checking'; slug: string }
  | SlugCheck
  /** The question could not be asked (no connection): the founding has the last word. */
  | { status: 'unknown'; slug: string };

/**
 * Live feedback for the link field of the sign-up (PLAN 2.2): what was typed in slug shape,
 * whether it is acceptable and, after a pause, whether it is free. An unacceptable link is
 * known at once and costs no read.
 */
export function useSlugCheck(raw: string): SlugAvailability {
  const slug = normalizeSlug(raw);
  const issue = slug === '' ? null : validateSlug(slug);
  const [settled, setSettled] = useState<{ slug: string; result: SlugAvailability } | null>(null);

  useEffect(() => {
    if (slug === '' || issue !== null) return undefined;
    let isCurrent = true;
    const settle = (result: SlugAvailability) => {
      if (isCurrent) setSettled({ slug, result });
    };
    const timer = setTimeout(() => {
      checkSlug(slug).then(settle, () => settle({ status: 'unknown', slug }));
    }, SLUG_CHECK_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [slug, issue]);

  if (slug === '') return { status: 'empty' };
  if (issue !== null) return { status: 'invalid', slug, issue };
  return settled?.slug === slug ? settled.result : { status: 'checking', slug };
}
