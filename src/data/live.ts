import { type DocumentReference, type DocumentSnapshot, onSnapshot } from 'firebase/firestore';
import { toDataError } from './errors';

export type Unsubscribe = () => void;

type Refs<T extends readonly unknown[]> = { [K in keyof T]: DocumentReference<T[K]> };
type Snapshots<T extends readonly unknown[]> = { [K in keyof T]: DocumentSnapshot<T[K]> };

export interface WatchOptions {
  /**
   * Report only what the server confirmed, never a copy from the local cache. For screens where
   * a decision is taken on exactly what is shown; the price is that nothing shows offline.
   */
  serverOnly?: boolean;
}

/**
 * A snapshot the screens must not act on yet: one that carries a local write the server has not
 * confirmed (its server timestamps are still guesses, and nothing here is optimistic), or a
 * "does not exist" answered from the local cache alone.
 */
function isProvisional(snapshot: DocumentSnapshot<unknown>, { serverOnly }: WatchOptions): boolean {
  const { hasPendingWrites, fromCache } = snapshot.metadata;
  return hasPendingWrites || (fromCache && (serverOnly === true || !snapshot.exists()));
}

/**
 * Listens to a handful of single documents — never a collection or a query — and reports them
 * together: `onChange` runs once every one of them is known and again whenever one changes.
 * A failure (of the listeners or of `onChange` itself, such as a malformed document) stops all
 * of them and is reported once, translated like every other data error.
 * Cost: one billed read per document when it starts and one per document that changes, plus
 * whatever the `get` rule of each document reads. Call the returned function to stop: a listener
 * left open keeps being billed.
 */
export function watchDocuments<T extends readonly unknown[]>(
  refs: Refs<T>,
  onChange: (snapshots: Snapshots<T>) => void,
  onError: (error: unknown) => void,
  options: WatchOptions = {},
): Unsubscribe {
  const latest: (DocumentSnapshot<unknown> | null)[] = refs.map(() => null);
  let stops: Unsubscribe[] = [];
  let hasStopped = false;
  const stop = () => {
    hasStopped = true;
    for (const each of stops) each();
  };
  const fail = (error: unknown) => {
    if (hasStopped) return;
    stop();
    onError(toDataError(error));
  };
  const receive = (index: number, snapshot: DocumentSnapshot<unknown>) => {
    if (hasStopped || isProvisional(snapshot, options)) return;
    latest[index] = snapshot;
    if (latest.includes(null)) return;
    try {
      onChange(latest as unknown as Snapshots<T>);
    } catch (error) {
      fail(error);
    }
  };
  // Metadata changes are asked for so that the confirmation of a local write, or of a cached
  // copy, always arrives: also when it changes nothing but "pending" or "from cache".
  stops = refs.map((ref, index) =>
    onSnapshot(
      ref as DocumentReference<unknown>,
      { includeMetadataChanges: true },
      (snapshot) => receive(index, snapshot),
      fail,
    ),
  );
  return stop;
}
