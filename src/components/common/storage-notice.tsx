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
          className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-40 mx-auto flex max-w-md flex-col gap-3 rounded-xl bg-card p-4 shadow-float sm:flex-row sm:items-center lg:right-auto lg:bottom-6 lg:left-6 lg:mx-0"
        >
          <p className="text-sm text-muted-foreground">
            Hornilla guarda en tu dispositivo solo lo necesario para funcionar: tu sesión y tus
            preferencias. Sin publicidad ni rastreo.{' '}
            <Link
              to={ROUTES.cookies}
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Ver qué se guarda
            </Link>
          </p>
          <Button
            variant="ink"
            size="sm"
            onClick={dismiss}
            className="shrink-0 self-end sm:self-auto"
          >
            Entendido
          </Button>
        </m.section>
      )}
    </AnimatePresence>
  );
}
