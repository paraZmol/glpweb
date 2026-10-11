import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { TextLink } from '@/components/common/text-link';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '@/domain/tenancy/constants';
import type { FoundingAvailability } from '@/features/tenancy/founding-availability';
import { ROUTES } from '@/lib/routes';

type Stop = Exclude<FoundingAvailability, 'available'>;

/** Why an account cannot found another distributor, in the words every screen uses. */
export const FOUNDING_STOP_COPY: Record<Stop, { title: string; description: ReactNode }> = {
  limitReached: {
    title: `Ya registraste ${MAX_DISTRIBUTORS_PER_ACCOUNT} distribuidoras.`,
    description:
      'Es el máximo por cuenta. Puedes seguir trabajando con las que ya tienes desde tu central.',
  },
  blocked: {
    title: 'Por ahora no puedes registrar otra distribuidora.',
    description: (
      <>
        Una de tus distribuidoras está en solo lectura: suspendida, con un pago pendiente o con la
        prueba terminada. Cuando esté al día podrás registrar otra. Si crees que es un error,
        escribe a <TextLink to={ROUTES.contact}>Contacto y reclamos</TextLink>.
      </>
    ),
  },
};

function FoundingStop({ stop }: { stop: Stop }) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <EmptyState
        className="rounded-xl bg-card p-6 shadow-card"
        title={FOUNDING_STOP_COPY[stop].title}
        description={FOUNDING_STOP_COPY[stop].description}
        action={
          <ButtonLink to={ROUTES.officeHome} variant="ink">
            Ir a mi central
          </ButtonLink>
        }
      />
    </div>
  );
}

/** The account already founded as many distributors as one account may (terms §3). */
export const FoundingLimit = () => <FoundingStop stop="limitReached" />;

/**
 * The account founded a distributor that is read-only, so it cannot found another one
 * (`FoundingBlockedError`, PLAN 2.11). Nothing in the form can fix it: the form is not shown.
 */
export const FoundingBlocked = () => <FoundingStop stop="blocked" />;
