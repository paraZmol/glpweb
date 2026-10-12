import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextField } from '@/components/common/text-field';
import { checkBrandColor } from '@/domain/brand/brand-color-check';
import { normalizeHex } from '@/domain/brand/color';
import { type BrandThemeName, HORNILLA_BRAND_COLOR } from '@/domain/brand/derive-brand';
import { SUGGESTED_BRAND_COLORS } from '@/domain/brand/palette';

const FAINT_REASON: Record<BrandThemeName, string> = {
  light:
    'Ese color casi no se distingue del fondo blanco: tu botón se perdería. Este es el tono más cercano que sí se ve.',
  dark: 'Ese color casi no se distingue del fondo oscuro: tu botón se perdería de noche. Este es el tono más cercano que sí se ve.',
};

type BrandColorFieldProps = {
  /** The colour as typed. */
  color: string;
  error?: string;
  onChange: (color: string) => void;
};

/**
 * Choice of the brand colour of a distributor: a palette whose tones all pass the visibility
 * check, the code typed by hand or the device's own picker, and the closest tone that works
 * when the chosen one is too faint. Shared by the sign-up wizard and the profile editor.
 */
export function BrandColorField({ color, error, onChange }: BrandColorFieldProps) {
  const check = checkBrandColor(color);
  const chosen = normalizeHex(color);

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Colores sugeridos"
        className="flex flex-wrap gap-x-3 gap-y-4 pt-1 pl-1"
      >
        {SUGGESTED_BRAND_COLORS.map((suggested) => (
          <button
            key={suggested.color}
            type="button"
            role="radio"
            aria-checked={chosen === suggested.color}
            aria-label={suggested.name}
            title={suggested.name}
            onClick={() => onChange(suggested.color)}
            // The colour is data, not a token: it is what the distributor may choose.
            style={{ backgroundColor: suggested.color }}
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
        value={color}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        hint="El código de seis cifras con numeral, como aparece en el archivo de tu logo. El cuadro de la derecha abre el selector de tu dispositivo."
        trailing={
          <input
            type="color"
            aria-label="Abrir el selector de color"
            value={chosen ?? HORNILLA_BRAND_COLOR}
            onChange={(event) => onChange(event.target.value)}
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
            onClick={() => onChange(check.suggestion)}
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
    </>
  );
}
