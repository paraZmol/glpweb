import { useEffect, useRef } from 'react';
import { Highlight } from '@/components/brand/highlight';
import { StepBrand } from '@/components/founding/step-brand';
import { StepBusiness, type StepProps } from '@/components/founding/step-business';
import { StepLocation } from '@/components/founding/step-location';
import { StepReview } from '@/components/founding/step-review';
import type { FoundingStep } from '@/features/tenancy/founding-form';
import type { SlugAvailability } from '@/features/tenancy/use-slug-check';

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
