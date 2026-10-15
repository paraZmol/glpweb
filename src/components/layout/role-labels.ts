import type { MemberRole } from '@/domain/tenancy/types';

/** How a role reads in the interface. Neutral wording: it names the job, not the person. */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Titular',
  dispatcher: 'Central',
  driver: 'Reparto',
};

/** What each role does, said where a role is chosen or offered (PLAN 3.2). */
export const ROLE_DUTIES: Record<MemberRole, string> = {
  owner: 'Puede casi todo: el personal, los precios y la ficha de la distribuidora.',
  dispatcher: 'Atiende los pedidos de la central y cambia el catálogo y los precios.',
  driver: 'Entrega los pedidos desde su celular y cuadra su caja al final del día.',
};
