import { ArrowRight, Flame, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

/** Where "Quiero pedir gas" lands: the list of distributors that reach the point. */
export const FINDER_ANCHOR = 'distribuidoras-cerca';

const CARD =
  'press group flex min-h-20 items-center gap-4 rounded-2xl p-4 motion-instant lg:min-h-24 lg:p-6';

function PathBody({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-background/70 dark:bg-background/30">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-heading text-xl font-extrabold">{title}</span>
        <span className="block text-[0.9375rem] opacity-80">{text}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        strokeWidth={ICON_STROKE}
        className="size-5 shrink-0 transition-transform motion-fast group-hover:translate-x-1 group-focus-visible:translate-x-1 group-active:translate-x-1 motion-reduce:translate-none"
      />
    </>
  );
}

/**
 * The home speaks to both audiences from the top (PLAN §11, 2026-10-16): whoever buys gas and
 * whoever owns a distributor each see their way right under the hero.
 */
export function TwoPaths() {
  return (
    <nav aria-label="¿Qué buscas?" className="grid gap-3 sm:grid-cols-2 lg:gap-5">
      <a href={`#${FINDER_ANCHOR}`} className={`${CARD} bg-primary-soft text-foreground`}>
        <PathBody
          icon={
            <Flame aria-hidden="true" strokeWidth={ICON_STROKE} className="text-primary-text" />
          }
          title="Quiero pedir gas"
          text="Mira qué distribuidoras llegan a tu puerta."
        />
      </a>
      <Link to={ROUTES.forDistributors} className={`${CARD} bg-flame-soft text-foreground`}>
        <PathBody
          icon={<Store aria-hidden="true" strokeWidth={ICON_STROKE} className="text-flame-text" />}
          title="Tengo una distribuidora"
          text="Que la gente de tu zona te encuentre."
        />
      </Link>
    </nav>
  );
}
