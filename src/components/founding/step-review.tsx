import { CheckboxField } from '@/components/common/checkbox-field';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { formatPhone } from '@/domain/tenancy/contact-links';
import { normalizeSlug } from '@/domain/tenancy/slug';
import type { FoundingForm } from '@/features/tenancy/founding-form';
import { distributorPath, ROUTES } from '@/lib/routes';
import type { StepProps } from './step-business';

/** Said when the plant has a point but no address: raw coordinates tell a person nothing. */
const PLANT_WITHOUT_ADDRESS = 'Ubicación marcada';

function summaryOf(form: FoundingForm): [term: string, value: string][] {
  return [
    ['Nombre', form.name.trim()],
    ['Enlace', distributorPath(normalizeSlug(form.slug))],
    ['Teléfono', formatPhone(form.contactPhone)],
    ['WhatsApp', formatPhone(form.whatsapp.trim() || form.contactPhone)],
    ['Planta', form.addressLine.trim() || PLANT_WITHOUT_ADDRESS],
    ['Cobertura', `${form.coverageRadiusKm} km desde la planta`],
  ];
}

// Reviewed by `legal-compliance` (PLAN 2.11): change them together with docs/legal. The summary
// above them holds public data only, which is what makes the first sentence true.
const PUBLIC_NOTICE =
  'Es público: nombre, enlace, teléfono, WhatsApp, dirección y ubicación de la planta. No es público: tu celular, tu RUC, tu razón social y tu número de registro.';
// Every idea the legal review asked for stays: created now, listed after a review that is not a
// certification, and the trial with what happens when it ends. "30 días" is said once.
const WHAT_COMES_NEXT = [
  'Tu distribuidora se crea ahora y puedes configurarla de inmediato.',
  'Aparece en el buscador cuando Hornilla revise sus datos. Revisar no es certificar: lo que declaras sigue siendo tu responsabilidad.',
  '30 días de prueba gratis desde hoy, también durante la revisión. No pedimos tarjeta y no hay ningún cobro al terminar. El precio de cada plan se informa antes de contratarlo; si al terminar la prueba no tienes un plan, tu panel queda en solo lectura y tu página deja de verse.',
];

/**
 * Step 4 (PLAN 2.2, 2.9, 2.11): what is about to be created, what of it will be public, what
 * happens after (the review of the platform, the trial) and the two declarations the founder
 * makes. Both boxes start unticked; nothing is created without them.
 */
export function StepReview({ form, errors, set }: StepProps) {
  return (
    <>
      <dl className="flex flex-col divide-y rounded-lg bg-muted px-4">
        {summaryOf(form).map(([term, value]) => (
          <div key={term} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
            <dt className="shrink-0 text-[0.9375rem] text-muted-foreground">{term}</dt>
            {/* A long link or address takes a row of its own instead of squeezing the term. */}
            <dd className="ml-auto min-w-0 text-right font-semibold wrap-anywhere tabular-nums">
              {value}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-[0.9375rem] text-muted-foreground">Color</dt>
          <dd className="flex items-center gap-2 font-semibold tabular-nums">
            <span
              aria-hidden="true"
              style={{ backgroundColor: form.brandColor }}
              className="size-5 rounded-full shadow-card"
            />
            {form.brandColor}
          </dd>
        </div>
      </dl>
      <InlineAlert tone="info">{PUBLIC_NOTICE}</InlineAlert>
      <section aria-labelledby="que-pasa-ahora" className="rounded-lg bg-primary-soft p-4">
        <h2 id="que-pasa-ahora" className="text-lg font-bold">
          Qué pasa ahora
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem] marker:text-primary-text">
          {WHAT_COMES_NEXT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <CheckboxField
        name="acceptTerms"
        checked={form.acceptTerms}
        onChange={(event) => set('acceptTerms', event.target.checked)}
        error={errors.acceptTerms}
      >
        Acepto los{' '}
        <TextLink to={ROUTES.terms} newTab>
          Términos y condiciones
        </TextLink>{' '}
        de Hornilla en nombre de esta distribuidora. Sé que los precios y las promociones que
        publique son responsabilidad de la distribuidora.
      </CheckboxField>
      <CheckboxField
        name="declaresAuthority"
        checked={form.declaresAuthority}
        onChange={(event) => set('declaresAuthority', event.target.checked)}
        error={errors.declaresAuthority}
      >
        Declaro que puedo representar a este negocio y que cuenta con las autorizaciones que la ley
        exige para comercializar GLP.
      </CheckboxField>
    </>
  );
}
