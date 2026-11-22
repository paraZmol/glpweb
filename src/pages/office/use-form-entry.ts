import { useLocation, useNavigate } from 'react-router';

/** What an open form keeps in its entry of the history: its distributor and what it opened. */
interface FormEntry {
  distributorId: string;
  value: unknown;
}

function readFormEntry(state: unknown, key: string): FormEntry | null {
  if (typeof state !== 'object' || state === null || !(key in state)) return null;
  const entry = (state as Record<string, unknown>)[key];
  if (typeof entry !== 'object' || entry === null) return null;
  const { distributorId, value } = entry as Record<string, unknown>;
  return typeof distributorId === 'string' ? { distributorId, value } : null;
}

/**
 * A form of an office screen as a step of the browser history (PLAN 3.1), like the steps of the
 * sign-up: opening it adds an entry, so "back" (or the back gesture of a phone) closes it and
 * stays on the screen; "Cancelar" and saving go back the same way. The entry names its
 * distributor: switching to another one closes the form.
 *
 * `value` is what the form was opened with (an id, null for a new one, a small plain object),
 * as stored: the screen checks it (`undefined` while closed). Opening another one replaces the
 * step instead of piling them up.
 */
export function useFormEntry(key: string, distributorId: string | null) {
  const location = useLocation();
  const navigate = useNavigate();
  const entry = readFormEntry(location.state, key);
  const isOpen = entry !== null && entry.distributorId === distributorId;
  // The entry was added by opening the form: going back keeps "forward" meaningful.
  const hasOwnEntry = entry !== null && location.key !== 'default';
  const { pathname } = location;

  const open = (value: unknown) => {
    if (distributorId === null) return;
    void navigate(pathname, {
      replace: entry !== null,
      state: { [key]: { distributorId, value } },
    });
  };
  const close = () => {
    if (hasOwnEntry) void navigate(-1);
    else void navigate(pathname, { replace: true, state: null });
  };

  return { value: isOpen ? entry.value : undefined, open, close };
}
