import { WifiOff } from 'lucide-react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { ICON_STROKE } from '@/lib/icons';
import { bannerVariants } from '@/lib/motion';
import { useOnlineStatus } from '@/lib/use-online-status';

/**
 * Strip pinned to the top while the device has no connection (DIRECCION.md, "Sin conexión").
 * `data-offline-banner` lets the fixed chrome below move down (see `--top-inset`).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const variants = bannerVariants(useReducedMotion() ?? false);

  return (
    <div role="status" className="sticky top-0 z-50">
      <AnimatePresence initial={false}>
        {!isOnline && (
          <m.div
            data-offline-banner=""
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            className="flex min-h-11 items-center justify-center gap-2 bg-foreground px-4 py-2 text-center text-sm font-semibold text-background"
          >
            <WifiOff aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE} />
            Sin conexión. Mostrando lo último que se guardó.
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
