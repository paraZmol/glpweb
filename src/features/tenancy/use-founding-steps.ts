import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../../lib/routes';
import {
  foundedNameOf,
  foundingEntryState,
  hasFinishedFounding,
  readFoundingEntry,
} from './founding-draft';

interface StepsOptions {
  /** The run of the wizard on screen (`FoundingDraft.run`). */
  run: string;
  /** The first step that still has a problem: nothing after it may be shown. */
  furthestIndex: number;
  /** A history entry asked for a later step than allowed; the wizard shows why on `index`. */
  onHeldBack: (index: number) => void;
}

/**
 * The steps of the sign-up of a distributor as entries of the browser history (PLAN 2.2): the
 * back button (or the back gesture of a phone) returns to the previous step and "forward"
 * advances again. The entry only says which step it is; the step shown is never later than
 * `furthestIndex`, so the history cannot reach a step whose previous ones were not validated —
 * not with "forward" after breaking an answer, not after a reload emptied the draft.
 */
export function useFoundingSteps({ run, furthestIndex, onHeldBack }: StepsOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  // While the screen leaves (exit transition) the location is already the next one: frozen.
  const isHere = location.pathname === ROUTES.newDistributor;
  const entry = isHere ? readFoundingEntry(location.state) : null;
  const isOwnEntry = entry?.run === run;
  const requestedIndex = isOwnEntry ? entry.index : 0;
  const index = Math.min(requestedIndex, furthestIndex);
  // An entry of a run that already founded its distributor, reached again through the history.
  const isDone = entry !== null && !isOwnEntry && hasFinishedFounding(entry.run);

  const [position, setPosition] = useState({ index, isForward: true, moves: 0 });
  if (isHere && !isDone && position.index !== index) {
    setPosition({ index, isForward: index > position.index, moves: position.moves + 1 });
  }

  const isFirstLook = useRef(true);
  const needsOwnEntry = isHere && !isDone && (!isOwnEntry || requestedIndex !== index);
  useEffect(() => {
    const isArriving = isFirstLook.current;
    isFirstLook.current = false;
    if (!needsOwnEntry) return;
    const state = { ...(location.state as object | null), ...foundingEntryState(run, index) };
    void navigate(ROUTES.newDistributor, { replace: true, state });
    // Arriving (a reload, a new visit) explains nothing: the step is simply the first open one.
    if (requestedIndex > index && !isArriving) onHeldBack(index);
    // Only what decides the entry: the callback and the location object change on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOwnEntry, run, index, requestedIndex]);

  // A double click on "Continuar" asks twice for the same step: once before the screen has
  // moved (same entry of the history) or once more from the step that is leaving (an older
  // render). Either would leave two entries for one step, and the first "back" would do nothing.
  const shownIndex = useRef(index);
  const advancedFrom = useRef<string | null>(null);
  useEffect(() => {
    shownIndex.current = index;
  }, [index]);
  useEffect(() => {
    advancedFrom.current = null;
  }, [location.key]);
  const entryKey = location.key;
  const advance = useCallback(() => {
    if (shownIndex.current !== index || advancedFrom.current === entryKey) return;
    advancedFrom.current = entryKey;
    void navigate(ROUTES.newDistributor, { state: foundingEntryState(run, index + 1) });
  }, [navigate, run, index, entryKey]);
  /** Back to an earlier step through the history, so "forward" still leads where it led. */
  const returnTo = useCallback(
    (earlierIndex: number) => {
      if (earlierIndex < index) void navigate(earlierIndex - index);
    },
    [navigate, index],
  );
  /** A new run of the wizard on this same entry, after one that ended. */
  const startOver = useCallback(
    () =>
      void navigate(ROUTES.newDistributor, { replace: true, state: foundingEntryState(run, 0) }),
    [navigate, run],
  );

  /** What the finished run of this entry founded, to name it on the screen that says so. */
  const foundedName = isDone ? foundedNameOf(entry.run) : null;

  return { position, isDone, foundedName, advance, returnTo, startOver };
}
