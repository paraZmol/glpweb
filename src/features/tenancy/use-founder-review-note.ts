import { useMemo } from 'react';
import { getReviewNote } from '../../data/distributors-repo';
import { noteTextFor } from '../../domain/tenancy/listing';
import type { Distributor } from '../../domain/tenancy/types';
import { useAsyncResource } from '../../lib/use-async-resource';

/**
 * The text of the note a platform admin left lives apart from the control document (PLAN 3.2):
 * the whole staff sees that a note waits (`reviewNoteAt`), only the founder reads what it says.
 * Key of the read: one per note, so a new note is read again and the same one is not.
 */
function noteKeyOf(distributor: Distributor | null, uid: string | null): string | null {
  if (distributor === null || uid === null || distributor.ownerUid !== uid) return null;
  if (distributor.reviewNoteAt === null || distributor.reviewNote !== null) return null;
  return `review-note:${distributor.id}:${distributor.reviewNoteAt.getTime()}`;
}

/**
 * `distributor` with `reviewNote` filled in for its founder (`uid`), once the text arrives;
 * unchanged for everybody else, and while there is no note. A failed read leaves the text out:
 * the panel still says that something must be corrected.
 * Cost: one read (plus one by the rules) per note, only for the founder and only while a note
 * waits.
 */
export function useFounderReviewNote(
  distributor: Distributor | null,
  uid: string | null,
): Distributor | null {
  const key = noteKeyOf(distributor, uid);
  const note = useAsyncResource(key, () => getReviewNote(distributor?.id ?? ''));
  const stored = note.status === 'ready' ? note.data : null;
  return useMemo(() => {
    if (distributor === null || stored === null) return distributor;
    const reviewNote = noteTextFor(distributor, stored);
    return reviewNote === null ? distributor : { ...distributor, reviewNote };
  }, [distributor, stored]);
}
