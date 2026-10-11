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
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 lg:px-8">
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug sm:text-sm">
              Hornilla guarda en tu dispositivo solo lo necesario para funcionar
              <span className="hidden sm:inline">
                : tu sesión, una copia de tus datos recientes, tus preferencias y el último punto
                desde el que buscaste
              </span>
              . Sin publicidad ni rastreo.{' '}
              <Link
                to={ROUTES.cookies}
                className="font-semibold whitespace-nowrap underline underline-offset-4"
              >
                Ver qué se guarda
              </Link>
            </p>
            <Button variant="ink" size="sm" onClick={dismiss} className="shrink-0">
              Entendido
            </Button>
          </div>
        </m.section>
      )}
    </AnimatePresence>
  );
}
