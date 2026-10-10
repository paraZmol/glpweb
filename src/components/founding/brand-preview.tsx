import { BrandTheme } from '@/components/brand/brand-theme';
import { Monogram } from '@/components/brand/monogram';
import { buttonClassName } from '@/components/common/button';
import { normalizeHex } from '@/domain/brand/color';
import { deriveBrand } from '@/domain/brand/derive-brand';
import { cn } from '@/lib/utils';

// Each sample pins its own theme (`.light` / `.dark` in src/index.css), whatever the device uses.
const SAMPLES = [
  { scope: 'light', label: 'En modo claro' },
  { scope: 'dark', label: 'En modo oscuro' },
] as const;
const UNNAMED = 'Tu distribuidora';

/** True when Hornilla had to move the tone so that the button stays readable (ui-system §6). */
function isToneAdjusted(color: string): boolean {
  const chosen = normalizeHex(color);
  if (chosen === null) return false;
  const derived = deriveBrand(chosen);
  return derived.light.fill !== chosen || derived.dark.fill !== chosen;
}

type BrandPreviewProps = {
  /** The colour as typed; an unreadable value shows Hornilla's own. */
  color: string;
  name: string;
  className?: string;
};

/**
 * Live sample of a distributor's brand (PLAN 2.2): its monogram and a button, in light and in
 * dark at once, drawn by the same `BrandTheme` the real page uses.
 */
export function BrandPreview({ color, name, className }: BrandPreviewProps) {
  const shownName = name.trim() || UNNAMED;

  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-2">
        {SAMPLES.map(({ scope, label }) => (
          <figure key={scope} className={scope}>
            <BrandTheme color={color}>
              <div className="rounded-xl border bg-background p-4 text-foreground">
                <figcaption className="text-[0.8125rem] font-semibold text-muted-foreground">
                  {label}
                </figcaption>
                <div className="mt-3 flex items-center gap-3">
                  <Monogram name={shownName} />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg leading-tight font-bold">
                      {shownName}
                    </p>
                    <p className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[0.8125rem] font-bold text-primary-text">
                      Distribuidora de gas
                    </p>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className={cn(buttonClassName({ size: 'sm' }), 'pointer-events-none mt-4 w-full')}
                >
                  Pedir gas
                </span>
              </div>
            </BrandTheme>
          </figure>
        ))}
      </div>
      {isToneAdjusted(color) && (
        <p className="mt-2 text-sm text-muted-foreground">
          Hornilla ajusta un poco el tono cuando hace falta para que el texto se lea bien, sobre
          todo en modo oscuro.
        </p>
      )}
    </div>
  );
}
