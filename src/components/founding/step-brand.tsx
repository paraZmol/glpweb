import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextField } from '@/components/common/text-field';
import { checkBrandColor } from '@/domain/brand/brand-color-check';
import { normalizeHex } from '@/domain/brand/color';
import { type BrandThemeName, HORNILLA_BRAND_COLOR } from '@/domain/brand/derive-brand';
import { SUGGESTED_BRAND_COLORS } from '@/domain/brand/palette';
import { BrandPreview } from './brand-preview';
import type { StepProps } from './step-business';

const FAINT_REASON: Record<BrandThemeName, string> = {
  light:
    'Ese color casi no se distingue del fondo blanco: tu botón se perdería. Este es el tono más cercano que sí se ve.',
  dark: 'Ese color casi no se distingue del fondo oscuro: tu botón se perdería de noche. Este es el tono más cercano que sí se ve.',
};

/** Step 3 (PLAN 2.2): the colour of the brand, with a live sample in both themes. */
export function StepBrand({ form, errors, set }: StepProps) {
  const check = checkBrandColor(form.brandColor);
  const chosen = normalizeHex(form.brandColor);

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Colores sugeridos"
        className="flex flex-wrap gap-x-3 gap-y-4 pt-1 pl-1"
      >
        {SUGGESTED_BRAND_COLORS.map(({ name, color }) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={chosen === color}
            aria-label={name}
            title={name}
            onClick={() => set('brandColor', color)}
            // The colour is data, not a token: it is what the distributor may choose.
            style={{ backgroundColor: color }}
            className="press size-12 rounded-full shadow-card ring-foreground ring-offset-4 ring-offset-background motion-instant aria-checked:ring-2"
          />
        ))}
      </div>
      <TextField
        label="O escribe tu color"
        name="brandColor"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={HORNILLA_BRAND_COLOR}
        value={form.brandColor}
        onChange={(event) => set('brandColor', event.target.value)}
        error={errors.brandColor}
        hint="El código de seis cifras con numeral, como aparece en el archivo de tu logo. El cuadro de la derecha abre el selector de tu dispositivo."
        trailing={
          <input
            type="color"
            aria-label="Abrir el selector de color"
            value={chosen ?? HORNILLA_BRAND_COLOR}
            onChange={(event) => set('brandColor', event.target.value)}
            className="mr-1.5 size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
          />
        }
      />
      {!check.ok && check.reason === 'tooFaint' && (
        <InlineAlert tone="info">
          <p>{FAINT_REASON[check.theme]}</p>
          <Button
            type="button"
            variant="ink"
            size="sm"
            className="mt-3"
            onClick={() => set('brandColor', check.suggestion)}
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: check.suggestion }}
              className="size-4 rounded-full ring-1 ring-background"
            />
            Usar este tono
          </Button>
        </InlineAlert>
      )}
      <BrandPreview color={form.brandColor} name={form.name} className="lg:hidden" />
    </>
  );
}
