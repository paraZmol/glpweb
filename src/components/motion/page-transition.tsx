import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router';
import { pageVariants } from '@/lib/motion';
import { screenKeyOf, type TransitionDirection, transitionDirection } from '@/lib/routes';

/** Remembers the previous path to know whether we went into a detail, back, or sideways. */
function useDirection(pathname: string): TransitionDirection {
  const [trail, setTrail] = useState<{ pathname: string; direction: TransitionDirection }>({
    pathname,
    direction: 'fade',
  });
  if (trail.pathname === pathname) return trail.direction;
  const direction = transitionDirection(trail.pathname, pathname);
  setTrail({ pathname, direction });
  return direction;
}

/**
 * The one transition between screens (motion-system §3). Layouts render it where they would
 * render `<Outlet />`; pages never animate their own entrance. The first screen of a layout
 * appears at once, so the first paint is never delayed.
 */
export function PageTransition({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const isReduced = useReducedMotion() ?? false;
  const variants = pageVariants(useDirection(pathname), isReduced);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={screenKeyOf(pathname)}
        className={className}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
