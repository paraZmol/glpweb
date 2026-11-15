import type { Promotion } from '../../domain/pricing/promotion';

/**
 * The moment a list of promotions is judged at: when the screen opened, or later if the server
 * already wrote one after that. A promotion that starts "now" takes the server's time, which
 * may run ahead of this device: without this it would read "Programada" right after publishing.
 */
export function nowAfter(opened: Date, promotions: readonly Promotion[] | null): Date {
  const latest = Math.max(
    opened.getTime(),
    ...(promotions ?? []).map((promotion) => promotion.updatedAt.getTime()),
  );
  return new Date(latest);
}
