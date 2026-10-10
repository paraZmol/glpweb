import { useEffect, useRef } from 'react';
import { Highlight } from '@/components/brand/highlight';
import { ButtonLink } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { StepBrand } from '@/components/founding/step-brand';
import { StepBusiness, type StepProps } from '@/components/founding/step-business';
import { StepLocation } from '@/components/founding/step-location';
import { StepReview } from '@/components/founding/step-review';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '@/domain/tenancy/constants';
import type { FoundingStep } from '@/features/tenancy/founding-form';
import type { SlugAvailability } from '@/features/tenancy/use-slug-check';
import { ROUTES } from '@/lib/routes';

export const STEP_COPY: Record<
  FoundingStep,
  { label: string; title: string; highlighted: string; lead: string }
> = {
  business: {
    label: 'Negocio',
    title: 'Cuéntanos de',
    highlighted: 'tu negocio.',
    lead: 'Con estos datos armamos la página de tu distribuidora en Hornilla.',
  },
  location: {
    label: 'Ubicación',
    title: 'Dónde está',
    highlighted: 'tu planta.',
    lead: 'Desde ahí se mide a qué clientes les llegas.',
  },
  brand: {
    label: 'Marca',
    title: 'Ponle',
    highlighted: 'tu color.',
    lead: 'Lo llevan tu página, tu panel y la aplicación de tus repartidores.',
  },
  review: {
    label: 'Revisar',
    title: 'Revisa y',
    highlighted: 'crea tu distribuidora.',
    lead: 'Después podrás cambiarlo todo, salvo el enlace.',
  },
};

type StepHeadingProps = {
  step: FoundingStep;
  /** After moving between steps the heading takes the focus, so a screen reader says where it is. */
  takesFocus: boolean;
};

export function StepHeading({ step, takesFocus }: StepHeadingProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { title, highlighted, lead } = STEP_COPY[step];

  useEffect(() => {
    if (takesFocus) heading.current?.focus();
  }, [takesFocus]);

  return (
    <header className="mt-6">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-[2.125rem] font-extrabold text-balance outline-none lg:text-[2.5rem]"
      >
        {title} <Highlight>{highlighted}</Highlight>
      </h1>
      <p className="mt-3 text-lg text-pretty text-muted-foreground">{lead}</p>
    </header>
  );
}

/** The fields of the step on display. */
export function StepFields({
  step,
  slugAvailability,
  ...props
}: StepProps & { step: FoundingStep; slugAvailability: SlugAvailability }) {
  if (step === 'business') return <StepBusiness {...props} slugAvailability={slugAvailability} />;
  if (step === 'location') return <StepLocation {...props} />;
  return step === 'brand' ? <StepBrand {...props} /> : <StepReview {...props} />;
}

/** The account already founded as many distributors as one account may (terms §3). */
export function FoundingLimit() {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <EmptyState
        className="rounded-xl bg-card p-6 shadow-card"
        title={`Ya registraste ${MAX_DISTRIBUTORS_PER_ACCOUNT} distribuidoras.`}
        description="Es el máximo por cuenta. Puedes seguir trabajando con las que ya tienes desde tu central."
        action={
          <ButtonLink to={ROUTES.officeHome} variant="ink">
            Ir a mi central
          </ButtonLink>
        }
      />
    </div>
  );
}
