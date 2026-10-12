import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { type FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { BrandPreview } from '@/components/founding/brand-preview';
import { WizardProgress } from '@/components/founding/wizard-progress';
import { useAccount } from '@/features/account/account-context';
import { FOUNDING_STEPS } from '@/features/tenancy/founding-form';
import { rememberDistributor } from '@/features/tenancy/selection-storage';
import { useFoundingAvailability } from '@/features/tenancy/use-founding-availability';
import { useFoundingWizard } from '@/features/tenancy/use-founding-wizard';
import { stepVariants } from '@/lib/motion';
import { usePageTitle } from '@/lib/page-title';
import { JUST_FOUNDED_STATE, ROUTES } from '@/lib/routes';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { FoundingBlocked, FoundingDone, FoundingLimit } from './founding-stops';
import { STEP_COPY, StepFields, StepHeading } from './new-distributor-parts';

const OFFLINE_TEXT = 'Sin conexión: para crear tu distribuidora necesitas internet.';

/**
 * `/distribuidora/nueva` (PLAN 2.2): a short wizard, one subject per step, for an account with
 * a verified e-mail. Phone: one column. Desktop: the form on the left and the live sample of
 * the page on the right. Each step is an entry of the browser history. When it ends, the
 * account is the owner and lands on its office, which takes the place of the last step.
 */
export function NewDistributorPage() {
  usePageTitle('Registrar tu distribuidora');
  const { session, profile, current, reloadProfile } = useAccount();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const isReduced = useReducedMotion() ?? false;
  const formRef = useRef<HTMLFormElement>(null);

  const enter = (distributorId: string) => {
    // The panels open on the new distributor, also for whoever already worked at another one.
    if (current.status === 'ready') current.select(distributorId);
    else rememberDistributor(session.uid, distributorId);
    if (current.status === 'ready' || current.status === 'none') current.reload();
    reloadProfile();
    void navigate(ROUTES.officeHome, { replace: true, state: JUST_FOUNDED_STATE });
  };

  const owner = { displayName: profile?.displayName ?? '', phone: profile?.phone ?? null };
  const wizard = useFoundingWizard({ session, owner, onFounded: enter });
  useFocusFirstInvalid(formRef, wizard.errors);

  // Every distributor the account founded is looked at (PLAN 2.11); the founding itself still
  // has the last word (`isBlocked`). While the check runs the form is shown.
  const { availability } = useFoundingAvailability();
  if (wizard.isBlocked || availability === 'blocked') return <FoundingBlocked />;
  if (availability === 'limitReached' && !wizard.isSubmitting) return <FoundingLimit />;
  if (wizard.isDone) {
    return <FoundingDone name={wizard.foundedName} onStartOver={wizard.startOver} />;
  }

  const { step, position, errors, form } = wizard;
  const isLast = position.index === FOUNDING_STEPS.length - 1;
  const variants = stepVariants(position.isForward, isReduced);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isLast) return wizard.next();
    if (isOnline) wizard.submit();
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-12 px-4 pt-4 pb-14 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-20 lg:px-8 lg:pb-20">
      <section className="mx-auto w-full max-w-xl lg:max-w-none">
        <WizardProgress
          current={position.index + 1}
          total={FOUNDING_STEPS.length}
          label={STEP_COPY[step].label}
        />
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={step}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
          >
            <StepHeading step={step} takesFocus={position.moves > 0} />
            <form ref={formRef} noValidate onSubmit={submit} className="mt-7 flex flex-col gap-5">
              <StepFields
                step={step}
                form={form}
                errors={errors}
                set={wizard.set}
                slugAvailability={wizard.slugAvailability}
              />
              <FormStatus
                error={errors.form}
                isOnline={isOnline || !isLast}
                offlineText={OFFLINE_TEXT}
              />
              <div className="mt-2 flex gap-3">
                {position.index > 0 && (
                  <Button
                    type="button"
                    variant="line"
                    disabled={wizard.isSubmitting}
                    onClick={wizard.back}
                  >
                    Atrás
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1"
                  loading={wizard.isSubmitting || wizard.isAwaitingSlug}
                  loadingLabel={
                    wizard.isSubmitting ? 'Creando tu distribuidora…' : 'Comprobando el enlace…'
                  }
                  disabled={isLast && !isOnline}
                >
                  {isLast ? 'Crear mi distribuidora' : 'Continuar'}
                </Button>
              </div>
            </form>
          </m.div>
        </AnimatePresence>
      </section>
      <aside
        aria-label="Así se va a ver tu marca"
        className="sticky top-[calc(var(--top-inset)+1.5rem)] hidden rounded-2xl bg-surface-soft p-8 lg:block"
      >
        <h2 className="text-2xl font-extrabold">Así se va a ver.</h2>
        <p className="mt-2 mb-5 text-muted-foreground">
          Tu nombre y tu color, tal como los verán tus clientes de día y de noche.
        </p>
        <BrandPreview color={form.brandColor} name={form.name} />
      </aside>
    </div>
  );
}
