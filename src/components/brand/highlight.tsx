import type { ReactNode } from 'react';

/**
 * Marker-pen band under the key phrase of a headline (ui-system §9.3). Once per screen, in the
 * `h1` or on the key figure. The words keep the text colour: the primary never colours them.
 */
export function Highlight({ children }: { children: ReactNode }) {
  return <span className="highlight-mark">{children}</span>;
}
