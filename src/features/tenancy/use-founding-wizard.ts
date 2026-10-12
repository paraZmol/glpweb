import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../../domain/auth/session';
import { FoundingBlockedError } from '../../domain/tenancy/errors';
import { slugFromName } from '../../domain/tenancy/slug';
import { useAsyncAction } from '../../lib/use-async-action';
import { finishFoundingDraft, keepFoundingDraft, openFoundingDraft } from './founding-draft';
import {
  firstStepWithProblems,
  FOUNDING_STEPS,
  type FoundingErrors,
  type FoundingForm,
  foundingErrorsOf,
  type FoundingStep,
  stepOfErrors,
  toFoundingInput,
  validateFoundingStep,
} from './founding-form';
import { foundDistributor } from './tenancy-actions';
import { useFoundingSteps } from './use-founding-steps';
import { useSlugCheck } from './use-slug-check';

const TAKEN = 'Ese enlace ya lo usa otra distribuidora. Prueba con otro.';
const LAST_INDEX = FOUNDING_STEPS.length - 1;
/** How long "Continuar" waits for the answer about the link before going on without it. */
export const SLUG_ANSWER_WAIT_MS = 6_000;

export type SetFoundingField = <Field extends keyof FoundingForm>(
  field: Field,
  value: FoundingForm[Field],
) => void;

interface WizardOptions {
  session: Session;
  owner: { displayName: string; phone: string | null };
  onFounded: (distributorId: string) => void;
}

/**
 * State of the sign-up wizard of a distributor (PLAN 2.2): the form (a draft kept in memory, see
 * `founding-draft.ts`), the live check of its link, the step on display (an entry of the browser
 * history, see `useFoundingSteps`) and the founding itself. Each step is checked before leaving
 * it — the first one also waits for the answer about its link — and everything once more
 * before sending.
 */
export function useFoundingWizard({ session, owner, onFounded }: WizardOptions) {
  const [draft] = useState(() => openFoundingDraft(session.uid, owner));
  const [form, setForm] = useState(draft.form);
  const [isSlugOwn, setSlugOwn] = useState(draft.isSlugOwn);
  const [errors, setErrors] = useState<FoundingErrors>({});
  // "Continuar" was pressed while the link was still being checked: it goes on by itself.
  const [isAwaitingSlug, setAwaitingSlug] = useState(false);
  // The founding was refused because the account owns a read-only distributor (PLAN 2.11):
  // nothing in the form can fix that, so the screen shows a state of its own.
  const [isBlocked, setBlocked] = useState(false);
  const { isRunning, run } = useAsyncAction();
  const slugAvailability = useSlugCheck(form.slug);
  const isSlugTaken = slugAvailability.status === 'taken';
  const isSlugSettling = slugAvailability.status === 'checking';

  useEffect(() => keepFoundingDraft(draft.run, { form, isSlugOwn }), [draft.run, form, isSlugOwn]);

  const problemsOf = (target: FoundingStep): FoundingErrors => {
    const problems = validateFoundingStep(target, form);
    const isTaken = target === 'business' && isSlugTaken && !problems.slug;
    return isTaken ? { ...problems, slug: TAKEN } : problems;
  };

  // A link known to be taken holds the wizard on its first step, whatever the history asks for.
  const pendingStep = useMemo(() => firstStepWithProblems(form), [form]);
  const pendingIndex = pendingStep ? FOUNDING_STEPS.indexOf(pendingStep) : LAST_INDEX;
  const steps = useFoundingSteps({
    run: draft.run,
    furthestIndex: isSlugTaken ? 0 : pendingIndex,
    onHeldBack: (index) => setErrors(problemsOf(FOUNDING_STEPS[index] ?? 'business')),
  });
  const { position } = steps;
  const step: FoundingStep = FOUNDING_STEPS[position.index] ?? 'business';

  const set: SetFoundingField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // The link follows the name until the person writes one of their own.
      if (field === 'name' && !isSlugOwn) next.slug = slugFromName(next.name);
      return next;
    });
    if (field === 'slug') setSlugOwn(true);
    setAwaitingSlug(false);
    // A message belongs to the value that was refused: editing the field takes it away.
    const refused = field === 'latitude' || field === 'longitude' ? 'plant' : field;
    setErrors(({ [refused]: _edited, form: _whole, ...rest }) => rest);
  };

  const next = () => {
    const problems = problemsOf(step);
    setErrors(problems);
    if (Object.keys(problems).length > 0 || position.index >= LAST_INDEX) return;
    // An occupied link is found here, on its own step, not when everything else is filled in.
    if (step === 'business' && isSlugSettling) return setAwaitingSlug(true);
    steps.advance();
  };

  useEffect(() => {
    if (!isAwaitingSlug) return undefined;
    const goOn = (advance: () => void) => {
      setAwaitingSlug(false);
      advance();
    };
    if (!isSlugSettling) return goOn(next);
    // A weak signal can hold the question for long: past this the step goes on as it does when
    // the question cannot be asked at all, and the founding has the last word. Nothing was
    // edited meanwhile (an edit ends the wait), so the step is still the one that was checked.
    const timer = setTimeout(() => goOn(steps.advance), SLUG_ANSWER_WAIT_MS);
    return () => clearTimeout(timer);
    // Runs when the wait starts and when the answer arrives; it reads the state of that render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isAwaitingSlug, isSlugSettling]);

  const back = () => {
    setErrors({});
    steps.returnTo(position.index - 1);
  };

  const fail = (problems: FoundingErrors, at: FoundingStep | null) => {
    setErrors(problems);
    if (at) steps.returnTo(FOUNDING_STEPS.indexOf(at));
  };

  const submit = () => {
    const pending = firstStepWithProblems(form);
    if (pending) return fail(problemsOf(pending), pending);
    return void run(async () => {
      try {
        const distributorId = await foundDistributor(session, {
          ...toFoundingInput(form),
          acceptTerms: true,
          declaresAuthority: true,
        });
        // Its entries in the history are no longer a form that could found it twice.
        finishFoundingDraft(draft.run);
        onFounded(distributorId);
      } catch (error) {
        if (error instanceof FoundingBlockedError) return setBlocked(true);
        const problems = foundingErrorsOf(error);
        fail(problems, stepOfErrors(problems));
      }
    });
  };

  return {
    form,
    set,
    slugAvailability,
    step,
    position,
    errors,
    next,
    back,
    submit,
    isSubmitting: isRunning,
    isAwaitingSlug,
    isBlocked,
    /** Reached through the history after founding: there is nothing left to fill in here. */
    isDone: steps.isDone,
    foundedName: steps.foundedName,
    startOver: steps.startOver,
  };
}
