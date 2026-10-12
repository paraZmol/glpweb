import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { Link } from 'react-router';
import { bannerVariants } from '@/lib/motion';
import { ROUTES } from '@/lib/routes';
import { hasSeenStorageNotice, rememberStorageNoticeSeen } from '@/lib/storage-notice';
import { Button } from './button';

/**
 * Informative notice shown the first time (PLAN 2.7, docs/legal/cookies.md). It is NOT a
 * consent panel: the app stores only what it needs to work, so there is nothing to accept or
 * refuse. If analytics or advertising are ever added, this must become a real consent first.
 * It is a strip IN THE FLOW of the page, above every frame, and never a floating card: floating
 * over the bottom edge it sat on top of whatever control ended up there ("Guardar cambios",
 * "Usar mi ubicación", "Cerrar sesión", the decision bar of the platform). A strip pushes the
 * screen down instead, so it can not cover anything on any screen, present or future.
 */
export function StorageNotice() {
  const [isOpen, setOpen] = useState(() => !hasSeenStorageNotice());
  const variants = bannerVariants(useReducedMotion() ?? false);

  const dismiss = () => {
    rememberStorageNoticeSeen();
    setOpen(false);
  };

  return (
    // It is there from the first paint (no entrance, nothing shifts) and leaves upwards.
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.section
          aria-label="Aviso de almacenamiento"
          exit={variants.exit}
          className="bg-flame-soft text-foreground"
        >
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-1 lg:px-8 lg:py-2">
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-4 lg:text-sm lg:leading-snug">
              {/* A phone gets the short one: the strip must not push the home out of its first
                  view. Both say the same as docs/legal/cookies.md; the detail is one tap away. */}
              <span className="lg:hidden">Guardamos solo lo necesario. Sin rastreo.</span>
              <span className="hidden lg:inline">
                Hornilla guarda en tu dispositivo solo lo necesario para funcionar: tu sesión, una
                copia de tus datos recientes, la distribuidora que elegiste y el último punto desde
                el que buscaste. Sin publicidad ni rastreo.
              </span>{' '}
              <Link
                to={ROUTES.cookies}
                className="font-semibold whitespace-nowrap underline underline-offset-4"
              >
                Ver qué se guarda
              </Link>
            </p>
            {/* Compact to the eye; the small size brings its own 44 px touch area. */}
            <Button
              variant="ink"
              size="sm"
              onClick={dismiss}
              className="h-8 shrink-0 px-3.5 text-sm lg:h-10 lg:px-4 lg:text-[0.9375rem]"
            >
              Entendido
            </Button>
          </div>
        </m.section>
      )}
    </AnimatePresence>
  );
}
