import type { ReactNode } from 'react';
import { InlineAlert } from '@/components/common/inline-alert';

/** "o con tu correo": separates the two ways of entering. */
export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3 text-sm font-semibold text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Message of the whole form plus the reason why its button is off without a connection: a
 * disabled button always says why (DIRECCION.md, "Sin conexión").
 */
export function FormStatus({
  error,
  isOnline,
  offlineText,
}: {
  error?: string;
  isOnline: boolean;
  offlineText: string;
}) {
  return (
    <>
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      {!isOnline && <InlineAlert tone="info">{offlineText}</InlineAlert>}
    </>
  );
}
