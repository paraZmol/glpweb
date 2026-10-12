import { useState } from 'react';
import type { GeoPoint } from '@/domain/geo/distance';
import { useNearbyDistributors } from '@/features/tenancy/use-nearby-distributors';
import { useOnlineStatus } from '@/lib/use-online-status';
import { ResultsView } from './results-view';

/**
 * The search itself (PLAN 2.6). It is the only piece of the finder that needs the database, so
 * it travels in its own chunk: the home paints first and Firebase arrives when there is a point
 * to search from. Default export because it is loaded with `lazy`.
 */
export default function NearbyResults({ point }: { point: GeoPoint }) {
  const nearby = useNearbyDistributors(point);
  const isOnline = useOnlineStatus();
  // Judged once per visit to the screen: the list does not reshuffle under the reader.
  const [now] = useState(() => new Date());

  return <ResultsView resource={nearby} isOnline={isOnline} onRetry={nearby.reload} now={now} />;
}
