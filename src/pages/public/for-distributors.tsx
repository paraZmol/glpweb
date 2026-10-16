import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/common/button';
import { FaqList, type FaqItem } from '@/components/landing/faq-list';
import { OwnersHero, TRIAL_NOTE } from '@/components/landing/owners-hero';
import { OwnersOffer } from '@/components/landing/owners-offer';
import { OwnersSteps } from '@/components/landing/owners-steps';
import { OwnersTerms } from '@/components/landing/owners-terms';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { registerPathFrom, ROUTES } from '@/lib/routes';

const REGISTER_TO = registerPathFrom(ROUTES.newDistributor);

// Left out until the user decides it with business-strategist: whether there is a commission
// per cylinder (docs/marketing/portada.md, decision 3).
const OWNER_FAQ: readonly FaqItem[] = [
  {
    question: '¿Necesito saber de computadoras?',
    answer: 'Si usas WhatsApp, puedes usar Hornilla.',
  },
  {
    question: '¿Qué pasa si no pago al terminar la prueba?',
    answer: 'Tu panel queda en solo lectura y dejas de aparecer; no se te cobra nada.',
  },
  { question: '¿Mis precios los pongo yo?', answer: 'Sí, siempre.' },
];

/** `/para-distribuidoras` (PLAN 3.6): what Hornilla gives an owner, before any sign-up. */
export function ForDistributorsPage() {
  usePageTitle('Para distribuidoras');
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-2 pb-12 lg:gap-20 lg:px-8 lg:pt-6 lg:pb-20">
      <OwnersHero registerTo={REGISTER_TO} />
      <OwnersOffer />
      <OwnersSteps />
      <OwnersTerms />
      <FaqList id="preguntas-duenos" title="Preguntas del dueño" items={OWNER_FAQ} />
      <section
        aria-label="Registrar mi distribuidora"
        className="flex flex-col items-center gap-3 rounded-2xl bg-band p-8 text-center text-band-foreground lg:p-12"
      >
        <ButtonLink to={REGISTER_TO} variant="primary" size="lg" className="w-full sm:w-auto">
          Registrar mi distribuidora
          <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
        </ButtonLink>
        <p className="text-sm font-semibold text-band-foreground/80">{TRIAL_NOTE}</p>
      </section>
    </div>
  );
}
