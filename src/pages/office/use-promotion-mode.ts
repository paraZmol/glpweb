import type { Promotion } from '@/domain/pricing/promotion';
import type { PromotionMode } from './promotions-board';
import { useFormEntry } from './use-form-entry';

/** What the history entry keeps of a mode: ids, never whole promotions. */
type ModeEntry = { kind: 'add'; repeatId: string | null } | { kind: 'edit'; id: string };

function entryOf(mode: NonNullable<PromotionMode>): ModeEntry {
  return mode.kind === 'add'
    ? { kind: 'add', repeatId: mode.repeat?.id ?? null }
    : { kind: 'edit', id: mode.promotion.id };
}

/** The mode an entry names; null when it names a promotion that is not in the list (yet). */
function modeOf(value: unknown, promotions: readonly Promotion[] | null): PromotionMode {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Partial<{ kind: string; repeatId: unknown; id: unknown }>;
  if (entry.kind === 'add' && entry.repeatId === null) return { kind: 'add', repeat: null };
  const id = entry.kind === 'add' ? entry.repeatId : entry.id;
  const promotion = promotions?.find((item) => item.id === id);
  if (!promotion) return null;
  return entry.kind === 'add' ? { kind: 'add', repeat: promotion } : { kind: 'edit', promotion };
}

/**
 * Adding, repeating or editing a promotion as a step of the browser history (`useFormEntry`):
 * "back" closes the form and stays on the promotions; switching distributor closes it.
 */
export function usePromotionMode(
  distributorId: string | null,
  promotions: readonly Promotion[] | null,
) {
  const entry = useFormEntry('promotionForm', distributorId);
  const onMode = (next: PromotionMode) => (next ? entry.open(entryOf(next)) : entry.close());
  return { mode: modeOf(entry.value, promotions), onMode };
}
