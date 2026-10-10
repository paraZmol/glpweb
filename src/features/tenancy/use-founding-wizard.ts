import { useCallback, useState } from 'react';
import type { Session } from '../../domain/auth/session';
import { slugFromName } from '../../domain/tenancy/slug';
import { useAsyncAction } from '../../lib/use-async-action';
import {
  emptyFoundingForm,
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
import { useSlugCheck } from './use-slug-check';

const TAKEN = 'Ese enlace ya lo usa otra distribuidora. Prueba con otro.';

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
 * State of the sign-up wizard of a distributor (PLAN 2.2): the form, the live check of its link,
 * the step on display, the direction of the last move (for the transition) and the founding
 * itself. Each step is checked before leaving it, and everything once more before sending.
 */
export function useFoundingWizard({ session, owner, onFounded }: WizardOptions) {
  const [form, setForm] = useState(() => emptyFoundingForm(owner));
  const [isSlugOwn, setSlugOwn] = useState(false);
  const [position, setPosition] = useState({ index: 0, isForward: true, moves: 0 });
  const [errors, setErrors] = useState<FoundingErrors>({});
  const { isRunning, run } = useAsyncAction();
  const slugAvailability = useSlugCheck(form.slug);
  const isSlugTaken = slugAvailability.status === 'taken';
  const step: FoundingStep = FOUNDING_STEPS[position.index] ?? 'business';

  const goTo = useCallback((target: FoundingStep) => {
    const index = FOUNDING_STEPS.indexOf(target);
    setPosition((current) => ({
      index,
      isForward: index > current.index,
      moves: current.moves + 1,
    }));
  }, []);

  const set: SetFoundingField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // The link follows the name until the person writes one of their own.
      if (field === 'name' && !isSlugOwn) next.slug = slugFromName(next.name);
      return next;
    });
    if (field === 'slug') setSlugOwn(true);
    // A message belongs to the value that was refused: editing the field takes it away.
    const refused = field === 'latitude' || field === 'longitude' ? 'plant' : field;
    setErrors(({ [refused]: _edited, form: _whole, ...rest }) => rest);
  };

  const problemsOf = (target: FoundingStep): FoundingErrors => {
    const problems = validateFoundingStep(target, form);
    const isTaken = target === 'business' && isSlugTaken && !problems.slug;
    return isTaken ? { ...problems, slug: TAKEN } : problems;
  };

  const next = () => {
    const problems = problemsOf(step);
    setErrors(problems);
    const following = FOUNDING_STEPS[position.index + 1];
    if (Object.keys(problems).length === 0 && following) goTo(following);
  };

  const back = () => {
    const previous = FOUNDING_STEPS[position.index - 1];
    setErrors({});
    if (previous) goTo(previous);
  };

  const fail = (problems: FoundingErrors, at: FoundingStep | null) => {
    setErrors(problems);
    if (at && at !== step) goTo(at);
  };

  const submit = () => {
    const pending = firstStepWithProblems(form);
    if (pending) return fail(problemsOf(pending), pending);
    return void run(async () => {
      try {
        onFounded(
          await foundDistributor(session, {
            ...toFoundingInput(form),
            acceptTerms: true,
            declaresAuthority: true,
          }),
        );
      } catch (error) {
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
  };
}
