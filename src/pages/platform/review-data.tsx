import type { ReactNode } from 'react';
import { OutsideLink } from '@/components/common/outside-link';
import { formatCoordinates } from '@/domain/geo/coordinates';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { formatPhone } from '@/domain/tenancy/contact-links';
import { describeDays, formatTimeOfDay } from '@/domain/tenancy/schedule';
import type { ListingReview } from '@/features/platform/platform-actions';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { OFFICIAL_SOURCES } from '@/lib/official-sources';
import { distributorPath } from '@/lib/routes';

// Where the declared data is compared, by hand.
const SOURCES = [
  { label: 'Consulta de RUC en SUNAT', href: OFFICIAL_SOURCES.taxId },
  {
    label: 'Registro de Hidrocarburos en Osinergmin',
    href: OFFICIAL_SOURCES.hydrocarbonsRegistry,
  },
];

type Row = [term: string, value: ReactNode];

export function DataList({ rows }: { rows: Row[] }) {
  return (
    <dl className="flex flex-col divide-y">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="shrink-0 text-muted-foreground">{term}</dt>
          <dd className="min-w-0 text-right font-semibold wrap-anywhere tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-bold">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** What visitors will read once the listing is approved. */
export function publicRowsOf({ profile }: ListingReview): Row[] {
  const { schedule } = profile;
  const hours = `${formatTimeOfDay(schedule.opensAt)}–${formatTimeOfDay(schedule.closesAt)}`;
  return [
    ['Nombre', profile.name],
    ['Enlace', distributorPath(profile.slug)],
    ['Teléfono', formatPhone(profile.contactPhone)],
    ['WhatsApp', formatPhone(profile.whatsapp)],
    ['Dirección', profile.addressLine || 'Sin dirección'],
    ['Planta', formatCoordinates(profile.plant)],
    ['Cobertura', `${profile.coverageRadiusKm} km desde la planta`],
    ['Horario', `${describeDays(schedule.days)}, ${hours}`],
  ];
}

/** What the founder declared for the review. Never public. */
export function declaredRowsOf({ settings }: ListingReview): Row[] {
  return [
    ['RUC', settings.taxId || 'Sin declarar'],
    ['Razón social o titular', settings.legalName || 'Sin declarar'],
    ['Registro de Osinergmin', settings.hydrocarbonsRegistry || 'Sin declarar'],
  ];
}

export function holderRowsOf({ settings, control }: ListingReview): Row[] {
  return [
    ['Titular', settings.ownerName],
    ['Celular', formatPhone(settings.ownerPhone)],
    ['Correo', settings.ownerEmail],
    ['Registrada el', formatDateTime(control.createdAt, DEFAULT_TIMEZONE)],
    ['Fin de la prueba', formatDate(control.trialEndsAt, DEFAULT_TIMEZONE)],
  ];
}

/** Outside links to the public look-ups where the declared data is compared. */
export function SourceLinks() {
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {SOURCES.map(({ label, href }) => (
        <li key={href}>
          <OutsideLink href={href}>{label}</OutsideLink>
        </li>
      ))}
    </ul>
  );
}
