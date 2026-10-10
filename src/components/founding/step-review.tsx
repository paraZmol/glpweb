import { CheckboxField } from '@/components/common/checkbox-field';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { formatCoordinates } from '@/domain/geo/coordinates';
import { formatPhone } from '@/domain/tenancy/contact-links';
import { normalizeSlug } from '@/domain/tenancy/slug';
import { type FoundingForm, plantOf } from '@/features/tenancy/founding-form';
import { distributorPath, ROUTES } from '@/lib/routes';
import type { StepProps } from './step-business';

function summaryOf(form: FoundingForm): [term: string, value: string][] {
  const plant = formatCoordinates(plantOf(form));
  const address = form.addressLine.trim();
  return [
    ['Nombre', form.name.trim()],
    ['Enlace', distributorPath(normalizeSlug(form.slug))],
    ['Teléfono', formatPhone(form.contactPhone)],
    ['WhatsApp', formatPhone(form.whatsapp.trim() || form.contactPhone)],
    ['Planta', address ? `${address} (${plant})` : plant],
    ['Cobertura', `${form.coverageRadiusKm} km desde la planta`],
  ];
}

/**
 * Step 4 (PLAN 2.2, 2.9): what is about to be created, what of it will be public, and the two
 * declarations the founder makes. Both boxes start unticked; nothing is created without them.
 */
export function StepReview({ form, errors, set }: StepProps) {
  return (
    <>
      <dl className="flex flex-col divide-y rounded-lg bg-muted px-4">
        {summaryOf(form).map(([term, value]) => (
          <div key={term} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-[0.9375rem] text-muted-foreground">{term}</dt>
            <dd className="min-w-0 text-right font-semibold wrap-anywhere tabular-nums">{value}</dd>
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
      <InlineAlert tone="info">
        El nombre, el teléfono, el WhatsApp, la dirección y la ubicación de la planta serán
        públicos.
      </InlineAlert>
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
      <p className="rounded-lg bg-primary-soft p-4 font-semibold text-primary-text">
        30 días de prueba gratis. Después eliges un plan.
      </p>
    </>
  );
}
