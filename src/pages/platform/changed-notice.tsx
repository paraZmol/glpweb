import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import type { PlatformListFilter } from '@/domain/tenancy/listing';
import { platformListingPath } from '@/lib/routes';
import { FILTER_COPY, searchOf } from './listing-labels';

export const LISTING_CHANGED =
  'La ficha cambió mientras la revisabas. Revisa los datos nuevos antes de aprobar.';

/**
 * The owner edited the listing while the platform admin had it open (PLAN 2.11). The new data
 * is already on screen; an approval stays tied to what was looked at before until the admin says
 * it looked again.
 */
export function ChangedNotice({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <InlineAlert tone="info" className="mb-4">
      <p>{LISTING_CHANGED}</p>
      <Button type="button" variant="line" size="sm" className="mt-2.5" onClick={onAcknowledge}>
        Ya revisé los datos nuevos
      </Button>
    </InlineAlert>
  );
}

export const STANDING_CHANGED = 'Otra persona de Hornilla cambió el estado de esta ficha.';

/**
 * Another platform admin suspended, reactivated or decided on the distributor while this one had
 * it open: the chips and the decisions on screen already follow it. Not a change of the data
 * under review, so nothing has to be looked at again.
 */
export function StandingChangedNotice() {
  return (
    <InlineAlert tone="info" className="mb-4">
      {STANDING_CHANGED}
    </InlineAlert>
  );
}

type MovedNoticeProps = {
  distributorId: string;
  /** The list the screen is titled after, which the distributor has left. */
  from: PlatformListFilter;
  /** The list it is in now. */
  to: PlatformListFilter;
};

/**
 * After a decision the distributor no longer belongs to the list beside it (or to the title
 * above it): say where it went, instead of leaving an approved listing under "Altas pendientes".
 */
export function MovedNotice({ distributorId, from, to }: MovedNoticeProps) {
  const here = `${platformListingPath(distributorId)}${searchOf(to)}`;
  return (
    <p role="status" className="text-muted-foreground">
      Ya no está en la lista «{FILTER_COPY[from].tab}»: ahora figura en{' '}
      <TextLink to={here}>{FILTER_COPY[to].tab}</TextLink>.
    </p>
  );
}
