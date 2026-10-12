import { useState } from 'react';
import { StateChip, type SystemState } from '@/components/common/state-chip';
import { type PlanSummary, planSummaryOf } from '@/domain/tenancy/status-summary';
import type { Distributor } from '@/domain/tenancy/types';

function describe(summary: PlanSummary): { state: SystemState; text: string } {
  switch (summary.kind) {
    case 'trial':
      return {
        state: 'free',
        text:
          summary.daysLeft === 1
            ? 'Prueba gratis · queda 1 día'
            : `Prueba gratis · quedan ${summary.daysLeft} días`,
      };
    case 'trialOver':
      return { state: 'danger', text: 'Prueba terminada' };
    case 'active':
      return { state: 'free', text: 'Plan activo' };
    case 'pastDue':
      return { state: 'paused', text: 'Pago pendiente' };
    case 'suspended':
      return { state: 'danger', text: 'Suspendida' };
  }
}

/** Where the plan of the distributor stands, as a system state chip (glyph and words). */
export function PlanChip({ distributor }: { distributor: Distributor }) {
  // Judged once when the chip appears: the day does not change under the reader.
  const [now] = useState(() => new Date());
  const { state, text } = describe(planSummaryOf(distributor, now));
  return (
    <StateChip state={state} className="tabular-nums">
      {text}
    </StateChip>
  );
}
