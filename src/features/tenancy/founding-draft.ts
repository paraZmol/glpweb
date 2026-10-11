import { emptyFoundingForm, FOUNDING_STEPS, type FoundingForm } from './founding-form';

/**
 * What a person has typed so far in the sign-up of a distributor (PLAN 2.2), kept IN MEMORY
 * ONLY: it survives the back and forward buttons of the browser and leaving the wizard for
 * another screen, and it dies with the tab or a reload. It holds the RUC and a personal phone,
 * so it is never written to `localStorage`, `sessionStorage` or the history entry: nothing here
 * needs a line in docs/legal/cookies.md. Ending a session reloads the app, which empties it, and
 * a draft is only ever handed to the account that started it.
 */
export interface FoundingDraft {
  /** Names one run of the wizard: the history entries of its steps carry it. */
  run: string;
  uid: string;
  form: FoundingForm;
  /** The person wrote a link of their own, so it stopped following the name. */
  isSlugOwn: boolean;
}

let draft: FoundingDraft | null = null;
const finishedRuns = new Set<string>();

type Owner = { displayName: string; phone: string | null };

/** The draft the account left open, or a new empty one. */
export function openFoundingDraft(uid: string, owner: Owner): FoundingDraft {
  if (draft?.uid !== uid) {
    draft = { run: crypto.randomUUID(), uid, form: emptyFoundingForm(owner), isSlugOwn: false };
  }
  return draft;
}

/** Keeps what the wizard holds now. Ignored once that run has ended. */
export function keepFoundingDraft(run: string, held: Pick<FoundingDraft, 'form' | 'isSlugOwn'>) {
  if (draft?.run === run) draft = { ...draft, ...held };
}

/** The run founded its distributor: its answers go, and its history entries stop being a form. */
export function finishFoundingDraft(run: string): void {
  finishedRuns.add(run);
  if (draft?.run === run) draft = null;
}

export function hasFinishedFounding(run: string): boolean {
  return finishedRuns.has(run);
}

/** Drops whatever is held, so the next visit of the wizard starts empty. */
export function forgetFoundingDraft(): void {
  draft = null;
}

const ENTRY_KEY = 'founding';

export interface FoundingEntry {
  run: string;
  /** Index in `FOUNDING_STEPS`. */
  index: number;
}

/**
 * What each step writes in its history entry: which run it belongs to and which step it is.
 * Never the answers: the entry outlives a reload, the draft must not.
 */
export function foundingEntryState(
  run: string,
  index: number,
): Record<typeof ENTRY_KEY, FoundingEntry> {
  return { [ENTRY_KEY]: { run, index } };
}

/** Reads what `foundingEntryState` wrote, distrusting it like any other outside value. */
export function readFoundingEntry(state: unknown): FoundingEntry | null {
  if (typeof state !== 'object' || state === null || !(ENTRY_KEY in state)) return null;
  const entry = state[ENTRY_KEY];
  if (typeof entry !== 'object' || entry === null) return null;
  const { run, index } = entry as Partial<FoundingEntry>;
  const isStep = Number.isInteger(index) && FOUNDING_STEPS[index as number] !== undefined;
  return typeof run === 'string' && isStep ? { run, index: index as number } : null;
}
