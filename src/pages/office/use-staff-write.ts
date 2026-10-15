import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { describeStaffError, staffFieldMessagesOf } from '@/features/staff/staff-messages';

/** A refused field (a helper's name) says its own message; anything else, the general one. */
function messageOf(error: unknown): string {
  return Object.values(staffFieldMessagesOf(error))[0] ?? describeStaffError(error);
}

/**
 * One change of the staff screen at a time (PLAN 3.2): it waits for the database — nothing here
 * is optimistic, a refusal of the rules must never look like a success — says how it went and
 * loads the list again either way. `busy` names what is running, for its button.
 */
export function useStaffWrite(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const isRunning = useRef(false);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    if (isRunning.current) return false;
    isRunning.current = true;
    setBusy(key);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(messageOf(error));
      return false;
    } finally {
      isRunning.current = false;
      setBusy(null);
      reload();
    }
  };

  return { busy, run };
}
