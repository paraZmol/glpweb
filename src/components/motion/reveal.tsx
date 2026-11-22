import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { listItemVariants, REVEAL_VIEWPORT } from '@/lib/motion';

type RevealProps = { className?: string; children: ReactNode };

/**
 * A section below the first view "arrives" when it scrolls in: fades in and rises 8 px, once
 * (docs/marketing/movimiento-portada.md, Acuerdo final). Never for anything in the first view:
 * it starts invisible. With reduced motion it renders in place, never hidden.
 */
export function Reveal({ className, children }: RevealProps) {
  const isReduced = useReducedMotion() ?? false;
  if (isReduced) return <div className={className}>{children}</div>;
  const variants = listItemVariants(0, false);
  return (
    <m.div
      className={className}
      initial={variants.initial}
      whileInView={variants.animate}
      viewport={REVEAL_VIEWPORT}
    >
      {children}
    </m.div>
  );
}
