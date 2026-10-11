import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';

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
