import { checkVisibleText, type Validated } from '../tenancy/field-checks';
import { HELPER_NAME_MAX_LENGTH, MAX_HELPERS } from './constants';

/**
 * A helper (ayudante): goes with the driver of a truck, never signs in and receives no orders
 * (PLAN §3). It exists only as data the driver picks when it opens a shift (phase 5), so it holds
 * the least that identifies the person to the staff: a name, and whether it still works there.
 * At `/distributors/{d}/helpers/{slot}`.
 */
export interface Helper {
  /** Slot, `h00` … `h29`. */
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SLOT_DIGITS = 2;

/** `h00` … `h29`: the fixed ids helpers may use (firebase/firestore.rules: `^h[0-2][0-9]$`). */
export const HELPER_SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_HELPERS },
  (_, index) => `h${String(index).padStart(SLOT_DIGITS, '0')}`,
);

/** The first slot no helper uses; null when every slot is taken. */
export function freeHelperSlot(helpers: readonly Pick<Helper, 'id'>[]): string | null {
  const used = new Set(helpers.map((helper) => helper.id));
  return HELPER_SLOT_IDS.find((slot) => !used.has(slot)) ?? null;
}

/** Active first, then by name, so the driver finds whom it is looking for. */
export function sortHelpers<T extends Pick<Helper, 'name' | 'active' | 'id'>>(
  helpers: readonly T[],
): T[] {
  return [...helpers].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.name.localeCompare(b.name, 'es') ||
      a.id.localeCompare(b.id),
  );
}

const SPACES = /\s+/g;

/**
 * The name of a helper as the owner typed it, trimmed and with single spaces: a letter or digit
 * at least, nothing invisible, up to `HELPER_NAME_MAX_LENGTH`. The rules hold the same check.
 */
export function prepareHelperName(raw: string): Validated<string> {
  const name = raw.trim().replace(SPACES, ' ');
  const code = checkVisibleText(name, 1, HELPER_NAME_MAX_LENGTH);
  return code ? { ok: false, issues: [{ field: 'name', code }] } : { ok: true, value: name };
}
