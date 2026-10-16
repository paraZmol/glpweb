import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { describeStaffError, staffFieldMessagesOf } from '@/features/staff/staff-messages';

/** The message of a refused field (a helper's name), or null when the error is not about one. */
function fieldMessageOf(error: unknown): string | null {
  return Object.values(staffFieldMessagesOf(error))[0] ?? null;
}

/**
 * One change of the staff screen at a time (PLAN 3.2): it waits for the database — nothing here
 * is optimistic, a refusal of the rules must never look like a success — says how it went and
 * loads the list again either way. `busy` names what is running, for its button. A refused
 * field goes to `onFieldError`, for the form to say it under its field (a toast goes away before
 * the person tries again); without one, it is a toast like any other refusal.
 */
export function useStaffWrite(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const isRunning = useRef(false);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
    onFieldError?: (message: string) => void,
  ): Promise<boolean> => {
    if (isRunning.current) return false;
    isRunning.current = true;
    setBusy(key);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      const field = fieldMessageOf(error);
      if (field !== null && onFieldError) onFieldError(field);
      else toast.error(field ?? describeStaffError(error));
      return false;
    } finally {
      isRunning.current = false;
      setBusy(null);
      reload();
    }
  };

  return { busy, run };
}
