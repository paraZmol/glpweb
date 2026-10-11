import { beforeEach, describe, expect, it } from 'vitest';
import {
  finishFoundingDraft,
  forgetFoundingDraft,
  foundingEntryState,
  hasFinishedFounding,
  keepFoundingDraft,
  openFoundingDraft,
  readFoundingEntry,
} from './founding-draft';
import { FOUNDING_STEPS } from './founding-form';

// Invented data: the repository is public.
const OWNER = { displayName: 'Persona Demo', phone: '900000051' };

beforeEach(() => forgetFoundingDraft());

// PLAN 2.2. role-walker 2026-10-11: the back button of the browser emptied the sign-up.
describe('draft of the sign-up of a distributor', () => {
  it('starts empty, with the owner known', () => {
    const draft = openFoundingDraft('u-1', OWNER);

    expect(draft.form).toMatchObject({ name: '', taxId: '', ownerPhone: '900000051' });
    expect(draft.isSlugOwn).toBe(false);
  });

  it('gives back what was typed when the wizard is opened again', () => {
    const { run, form } = openFoundingDraft('u-1', OWNER);
    keepFoundingDraft(run, {
      form: { ...form, name: 'Gas Demo', taxId: '20000000001' },
      isSlugOwn: true,
    });

    const reopened = openFoundingDraft('u-1', OWNER);

    expect(reopened.run).toBe(run);
    expect(reopened.form).toMatchObject({ name: 'Gas Demo', taxId: '20000000001' });
    expect(reopened.isSlugOwn).toBe(true);
  });

  it('never hands the draft of one account to another', () => {
    const first = openFoundingDraft('u-1', OWNER);
    keepFoundingDraft(first.run, {
      form: { ...first.form, taxId: '20000000001' },
      isSlugOwn: false,
    });

    const other = openFoundingDraft('u-2', { displayName: 'Otra Persona', phone: null });

    expect(other.run).not.toBe(first.run);
    expect(other.form).toMatchObject({ taxId: '', ownerName: 'Otra Persona', ownerPhone: '' });
  });

  it('ends with the founding: nothing is left, and the run is known as finished', () => {
    const { run, form } = openFoundingDraft('u-1', OWNER);
    keepFoundingDraft(run, { form: { ...form, name: 'Gas Demo' }, isSlugOwn: false });

    finishFoundingDraft(run);

    expect(hasFinishedFounding(run)).toBe(true);
    const next = openFoundingDraft('u-1', OWNER);
    expect(next.run).not.toBe(run);
    expect(next.form.name).toBe('');
    expect(hasFinishedFounding(next.run)).toBe(false);
  });

  it('ignores what a finished run still tries to keep', () => {
    const old = openFoundingDraft('u-1', OWNER);
    finishFoundingDraft(old.run);
    const next = openFoundingDraft('u-1', OWNER);

    keepFoundingDraft(old.run, { form: { ...old.form, name: 'Gas Viejo' }, isSlugOwn: true });

    expect(openFoundingDraft('u-1', OWNER)).toEqual(next);
  });

  it('writes nothing on the device', () => {
    const { run, form } = openFoundingDraft('u-1', OWNER);
    keepFoundingDraft(run, { form: { ...form, taxId: '20000000001' }, isSlugOwn: false });

    // Under Node there is no storage at all: reaching for one would have thrown above.
    expect(typeof localStorage).toBe('undefined');
    expect(typeof sessionStorage).toBe('undefined');
  });
});

describe('history entry of a step', () => {
  it('says the run and the step, and never an answer', () => {
    const state = foundingEntryState('run-1', 2);

    expect(readFoundingEntry(state)).toEqual({ run: 'run-1', index: 2 });
    expect(JSON.stringify(state)).toBe('{"founding":{"run":"run-1","index":2}}');
  });

  it('is read next to whatever else travels in the state', () => {
    expect(readFoundingEntry({ after: '/inicio', ...foundingEntryState('run-1', 0) })).toEqual({
      run: 'run-1',
      index: 0,
    });
  });

  it.each([
    null,
    undefined,
    'texto',
    {},
    { founding: null },
    { founding: 'run-1' },
    { founding: { run: 7, index: 1 } },
    { founding: { run: 'run-1' } },
    { founding: { run: 'run-1', index: '1' } },
    { founding: { run: 'run-1', index: 1.5 } },
    { founding: { run: 'run-1', index: -1 } },
    { founding: { run: 'run-1', index: FOUNDING_STEPS.length } },
  ])('distrusts a state that is not one of its own: %j', (state) => {
    expect(readFoundingEntry(state)).toBeNull();
  });
});
