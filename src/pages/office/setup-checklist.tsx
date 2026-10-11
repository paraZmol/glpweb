import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { GLYPH_STROKE, ICON_STROKE } from '@/lib/icons';
import { distributorPath, ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

const COMING_SOON = 'Llega pronto';

type TaskProps = {
  title: string;
  detail: string;
  isDone?: boolean;
  /** What the owner can do about it today; a task without it is not available yet. */
  action?: ReactNode;
};

function Task({ title, detail, isDone = false, action }: TaskProps) {
  return (
    // Phone: the action goes under the words, which keep the whole width of the row.
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full',
          isDone
            ? 'bg-state-free text-state-free-foreground'
            : 'inset-ring-[1.5px] inset-ring-input',
        )}
      >
        {isDone && <Check className="size-4" strokeWidth={GLYPH_STROKE} />}
      </span>
      <p className={cn('min-w-0 text-muted-foreground', action && 'max-sm:col-span-2')}>
        <strong className="block font-heading text-base text-foreground">
          {title}
          {isDone && <span className="sr-only"> (hecho)</span>}
        </strong>
        {detail}
      </p>
      {action ? (
        <div className="max-sm:col-span-2 max-sm:col-start-2">{action}</div>
      ) : (
        !isDone && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.8125rem] font-bold text-muted-foreground">
            {COMING_SOON}
          </span>
        )
      )}
    </li>
  );
}

type SetupChecklistProps = {
  distributor: PublicDistributor;
  /** Whether visitors can open its page already (PLAN 2.11). */
  isListed: boolean;
};

/**
 * "Completa tu distribuidora" (PLAN 2.2): what the owner has done and what comes next. The
 * catalogue and the staff arrive with phase 3: they are listed, and said to be on their way.
 */
export function SetupChecklist({ distributor, isListed }: SetupChecklistProps) {
  return (
    <Panel dense>
      <h2 className="text-lg font-bold">Completa tu distribuidora</h2>
      <ul className="mt-1 flex flex-col divide-y">
        <Task
          title="Datos, enlace y color"
          detail="Lo que escribiste al registrarla. Puedes cambiarlo, salvo el enlace."
          isDone
          action={
            <ButtonLink to={ROUTES.officeProfile} variant="line" size="sm" className="shrink-0">
              Editar ficha
            </ButtonLink>
          }
        />
        <Task
          title="Mira tu página pública"
          detail={
            isListed
              ? 'Así la ven tus clientes. Comparte el enlace.'
              : 'Por ahora solo la ve tu personal: será pública cuando Hornilla revise tus datos.'
          }
          action={
            <ButtonLink
              to={distributorPath(distributor.slug)}
              variant="soft"
              size="sm"
              className="shrink-0"
            >
              Ver mi página
              <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
            </ButtonLink>
          }
        />
        <Task title="Carga tu catálogo" detail="Balones, marcas y precios." />
        <Task title="Suma a tu personal" detail="Central y repartidores, por invitación." />
      </ul>
    </Panel>
  );
}
