import { listVisibleDistributors } from '../../data/distributors-repo';
import { DISTRIBUTOR_SEARCH_LIMIT } from '../../domain/tenancy/constants';
import type { Distributor } from '../../domain/tenancy/types';

/** The search list changes rarely: one bounded query serves every search for a while. */
const FRESH_FOR_MS = 5 * 60 * 1000;

let cached: { loadedAtMs: number; list: Promise<Distributor[]> } | null = null;

/**
 * The bounded list of visible distributors (PLAN 2.6), shared between searches so that moving
 * the pin does not cost reads. `nowMs` comes from the caller (no hidden clock here).
 */
export function loadVisibleDistributors(nowMs: number): Promise<Distributor[]> {
  if (cached && nowMs - cached.loadedAtMs < FRESH_FOR_MS) return cached.list;
  const list = listVisibleDistributors({ limit: DISTRIBUTOR_SEARCH_LIMIT });
  cached = { loadedAtMs: nowMs, list };
  // A failed load must not be remembered, or the retry button would do nothing.
  list.catch(() => {
    if (cached?.list === list) cached = null;
  });
  return list;
}

export function forgetVisibleDistributors(): void {
  cached = null;
}
