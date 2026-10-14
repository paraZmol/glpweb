import { InlineAlert } from '@/components/common/inline-alert';

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
