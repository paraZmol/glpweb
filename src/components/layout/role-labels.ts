import type { MemberRole } from '@/domain/tenancy/types';

/** How a role reads in the interface. Neutral wording: it names the job, not the person. */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Titular',
  dispatcher: 'Central',
  driver: 'Reparto',
};
