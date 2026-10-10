import { Clock, MapPin } from 'lucide-react';
import { MapGap } from '@/components/common/map-gap';
import { describeDays, formatTimeOfDay } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { ContactActions } from './contact-actions';

const ICON_CLASS = 'size-5 shrink-0 text-primary-text';

/** Where it delivers: the gap of the coverage map, the radius and the address of the plant. */
export function CoverageCard({ distributor }: { distributor: PublicDistributor }) {
  const { coverageRadiusKm, addressLine } = distributor;
  return (
    <section aria-labelledby="cobertura" className="overflow-hidden rounded-xl bg-card shadow-card">
      <div className="p-3 pb-0">
        <MapGap className="h-44" />
      </div>
      <div className="p-4">
        <h3 id="cobertura" className="flex items-center gap-2 text-xl font-bold">
          <MapPin aria-hidden="true" className={ICON_CLASS} strokeWidth={ICON_STROKE} />
          Dónde reparte
        </h3>
        <p className="mt-1 text-muted-foreground tabular-nums">
          Hasta {coverageRadiusKm} km alrededor de su planta
          {addressLine ? `, en ${addressLine}` : ''}.
        </p>
      </div>
    </section>
  );
}

type ScheduleCardProps = {
  distributor: PublicDistributor;
  /** Phone and WhatsApp here too, when the page has no contact bar of its own. */
  withContact: boolean;
};

/** Opening hours and, when asked, the two ways of reaching the business. */
export function ScheduleCard({ distributor, withContact }: ScheduleCardProps) {
  const { schedule } = distributor;
  return (
    <section
      aria-labelledby="horario"
      className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-card"
    >
      <div>
        <h3 id="horario" className="flex items-center gap-2 text-xl font-bold">
          <Clock aria-hidden="true" className={ICON_CLASS} strokeWidth={ICON_STROKE} />
          Horario
        </h3>
        <dl className="mt-2 flex items-baseline justify-between gap-6 text-[0.9375rem] tabular-nums">
          <dt className="font-semibold">{describeDays(schedule.days)}</dt>
          <dd className="text-right text-muted-foreground">
            {formatTimeOfDay(schedule.opensAt)}–{formatTimeOfDay(schedule.closesAt)}
          </dd>
        </dl>
      </div>
      {withContact && <ContactActions distributor={distributor} className="mt-auto" />}
    </section>
  );
}
