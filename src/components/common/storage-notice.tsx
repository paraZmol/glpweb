import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { Link } from 'react-router';
import { riseVariants } from '@/lib/motion';
import { ROUTES } from '@/lib/routes';
import { hasSeenStorageNotice, rememberStorageNoticeSeen } from '@/lib/storage-notice';
import { Button } from './button';

/**
 * Informative notice shown the first time (PLAN 2.7, docs/legal/cookies.md). It is NOT a
 * consent panel: the app stores only what it needs to work, so there is nothing to accept or
 * refuse. If analytics or advertising are ever added, this must become a real consent first.
 * On a phone it is one compact row (it used to cover the form under it): the list of what is
 * stored is one tap away, and shown in full from `sm:` up.
 */
export function StorageNotice() {
  const [isOpen, setOpen] = useState(() => !hasSeenStorageNotice());
  const variants = riseVariants(useReducedMotion() ?? false);

  const dismiss = () => {
    rememberStorageNoticeSeen();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.section
          aria-label="Aviso de almacenamiento"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-40 mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-card py-2 pr-2 pl-3.5 shadow-float sm:p-4 lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
        >
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground sm:text-sm">
            Hornilla guarda en tu dispositivo solo lo necesario para funcionar
            <span className="hidden sm:inline">
              : tu sesión, una copia de tus datos recientes, tus preferencias y el último punto
              desde el que buscaste
            </span>
            . Sin publicidad ni rastreo.{' '}
            <Link
              to={ROUTES.cookies}
              className="font-semibold whitespace-nowrap text-foreground underline underline-offset-4"
            >
              Ver qué se guarda
            </Link>
          </p>
          <Button variant="ink" size="sm" onClick={dismiss} className="shrink-0">
            Entendido
          </Button>
        </m.section>
      )}
    </AnimatePresence>
  );
}
