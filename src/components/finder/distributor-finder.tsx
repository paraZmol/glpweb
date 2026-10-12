import { lazy, Suspense } from 'react';
import type { GeoPoint } from '@/domain/geo/distance';
import { ResultsView } from './results-view';

const NearbyResults = lazy(() => import('./nearby-results'));

const NOTHING_TO_RETRY = () => {};
// Only read by a list with results, which these two states never have.
const NO_CLOCK = new Date(0);

/** What shows before there is a search: no point yet, or the search code still on its way. */
function Placeholder({ status }: { status: 'idle' | 'loading' }) {
  return <ResultsView resource={{ status }} isOnline onRetry={NOTHING_TO_RETRY} now={NO_CLOCK} />;
}

/**
 * Results of the finder for a point (PLAN 2.6). Without a point nothing is fetched, not even
 * the code that talks to the database; with one, the skeleton holds the place until it arrives.
 */
export function DistributorFinder({ point }: { point: GeoPoint | null }) {
  if (point === null) return <Placeholder status="idle" />;
  return (
    <Suspense fallback={<Placeholder status="loading" />}>
      <NearbyResults point={point} />
    </Suspense>
  );
}
