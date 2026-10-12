import type { SystemState } from '@/components/common/state-chip';
import type { ListingState, PlatformListFilter } from '@/domain/tenancy/listing';
import type { DistributorStatus } from '@/domain/tenancy/types';
import { ROUTES } from '@/lib/routes';

// PLAN 2.11. The platform looks at what was declared: no label here says "verificada".
export const LISTING_LABELS: Record<ListingState, { text: string; state: SystemState }> = {
  inReview: { text: 'Sin revisar', state: 'paused' },
  changesRequested: { text: 'Con cambios pedidos', state: 'danger' },
  correctionsSent: { text: 'Correcciones enviadas', state: 'paused' },
  listed: { text: 'Aprobada y visible', state: 'free' },
  notOperating: { text: 'Aprobada, sin operar', state: 'offline' },
};

export const PLAN_LABELS: Record<DistributorStatus, string> = {
  trial: 'En prueba',
  active: 'Plan activo',
  pastDue: 'Pago pendiente',
  suspended: 'Suspendida',
};

interface FilterCopy {
  /** Value of `?estado=` in the address; the first list needs none. */
  param: string | null;
  tab: string;
  title: string;
  lead: string;
  empty: { title: string; description: string };
}

export const FILTER_COPY: Record<PlatformListFilter, FilterCopy> = {
  inReview: {
    param: null,
    tab: 'En revisión',
    title: 'Altas pendientes.',
    lead: 'Distribuidoras que esperan la revisión de Hornilla antes de aparecer en el buscador.',
    empty: {
      title: 'No hay altas pendientes.',
      description:
        'Cuando alguien registre una distribuidora, o cambie su nombre, un teléfono o su dirección, va a aparecer aquí para revisarla.',
    },
  },
  approved: {
    param: 'aprobadas',
    tab: 'Aprobadas',
    title: 'Distribuidoras aprobadas.',
    lead: 'Las que Hornilla ya revisó, también las que hoy no operan.',
    empty: {
      title: 'Todavía no hay distribuidoras aprobadas.',
      description: 'Cuando apruebes un alta va a aparecer aquí.',
    },
  },
  suspended: {
    param: 'suspendidas',
    tab: 'Suspendidas',
    title: 'Distribuidoras suspendidas.',
    lead: 'Las que están en solo lectura por decisión de Hornilla.',
    empty: {
      title: 'No hay distribuidoras suspendidas.',
      description: 'Cuando suspendas una va a aparecer aquí, para poder reactivarla.',
    },
  },
};

const FILTER_PARAM = 'estado';

/** The list the address asks for; anything unknown is the first one. */
export function filterOf(search: URLSearchParams): PlatformListFilter {
  const asked = search.get(FILTER_PARAM);
  if (asked === FILTER_COPY.approved.param) return 'approved';
  return asked === FILTER_COPY.suspended.param ? 'suspended' : 'inReview';
}

/** The `?estado=…` that keeps a list selected while a distributor is open; empty for the first. */
export function searchOf(filter: PlatformListFilter): string {
  const { param } = FILTER_COPY[filter];
  return param === null ? '' : `?${FILTER_PARAM}=${param}`;
}

/** Address of one list of the platform panel. */
export function platformListPath(filter: PlatformListFilter): string {
  return `${ROUTES.platformHome}${searchOf(filter)}`;
}
