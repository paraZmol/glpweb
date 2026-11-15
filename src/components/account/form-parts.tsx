import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { InlineAlert } from '@/components/common/inline-alert';

/**
 * Message of the whole form plus the reason why its button is off without a connection: a
 * disabled button always says why (DIRECCION.md, "Sin conexión"). A new message is brought into
 * view clear of the bottom bar: on a phone it lands right above the buttons, which the bar may
 * cover once the message pushes them down.
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
  const errorRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion() ?? false;

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ block: 'nearest', behavior: isReduced ? 'auto' : 'smooth' });
    // Only when the message changes, not when the motion preference does.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <>
      {error && (
        <div
          ref={errorRef}
          className="scroll-mt-[calc(var(--top-inset)+1rem)] scroll-mb-[calc(var(--bottom-nav-height)+1rem)]"
        >
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      )}
      {!isOnline && <InlineAlert tone="info">{offlineText}</InlineAlert>}
    </>
  );
}
