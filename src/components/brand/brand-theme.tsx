import type { CSSProperties, ReactNode } from 'react';
import { isHexColor } from '@/domain/brand/color';
import { brandCssVariables } from '@/domain/brand/derive-brand';

type BrandThemeProps = {
  /** The distributor's colour as stored (`#rrggbb`). Null or unreadable: Hornilla's own brand. */
  color: string | null | undefined;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps everything that belongs to one distributor (ui-system §6). It writes the eight
 * `--brand-*` variables for both themes; `[data-brand]` in src/index.css turns them into
 * `--primary` and its companions, so switching theme needs no re-render.
 */
export function BrandTheme({ color, className, children }: BrandThemeProps) {
  if (!color || !isHexColor(color)) return <div className={className}>{children}</div>;
  return (
    <div data-brand="" className={className} style={brandCssVariables(color) as CSSProperties}>
      {children}
    </div>
  );
}

type GasBrandThemeProps = {
  /** Colour of the gas brand of a product, from the catalogue. */
  color: string | null | undefined;
  className?: string;
  children: ReactNode;
};

/** Same derivation for the gas brand of a product: colours the cylinder, not the buttons. */
export function GasBrandTheme({ color, className, children }: GasBrandThemeProps) {
  if (!color || !isHexColor(color)) return <div className={className}>{children}</div>;
  return (
    <div
      data-gas-brand=""
      className={className}
      style={brandCssVariables(color, 'gas') as CSSProperties}
    >
      {children}
    </div>
  );
}
