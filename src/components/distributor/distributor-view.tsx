import { BrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { EmptyState } from '@/components/common/state-views';
import { TextLink } from '@/components/common/text-link';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { describeOpenStatus, openStatusAt } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ROUTES } from '@/lib/routes';
import { ContactActions } from './contact-actions';
import { CoverageCard, ScheduleCard } from './distributor-details';
import { DistributorHero } from './distributor-hero';
import { PrivatePreviewStrip } from './private-preview-strip';

const EMPTY_CYLINDER_PX = 72;
const FOOT_LOGO_PX = 20;

function statusOf(distributor: PublicDistributor, now: Date) {
  if (!distributor.acceptingOrders) return { isOpen: false, text: 'Todavía no es pública' };
  const open = openStatusAt(distributor.schedule, now, DEFAULT_TIMEZONE);
  return { isOpen: open.isOpen, text: describeOpenStatus(open) };
}

/** The products of the distributor. The catalogue is phase 3: until then, a designed gap. */
function Catalog() {
  return (
    <section aria-labelledby="catalogo">
      <h2 id="catalogo" className="text-[1.75rem] font-extrabold lg:text-4xl">
        Balones y precios
      </h2>
      <EmptyState
        className="mt-4 rounded-xl bg-card p-6 shadow-card"
        symbol={<GasCylinder weightKg={10} tone="mono" height={EMPTY_CYLINDER_PX} />}
        title="Esta distribuidora todavía no publicó su catálogo."
        description="Aquí van a aparecer sus balones, sus marcas y el precio de la recarga y del balón completo. Mientras tanto puedes preguntarle por teléfono o por WhatsApp."
      />
    </section>
  );
}

/** Desktop: the column that will hold "Tu pedido"; today, the direct way to the business. */
function ContactAside({ distributor }: { distributor: PublicDistributor }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[calc(var(--top-inset)+1.5rem)] rounded-2xl bg-card p-6 shadow-raised">
        <h2 className="text-2xl font-extrabold">Pide directo.</h2>
        <p className="mt-2 text-muted-foreground">
          Pedir desde Hornilla llega pronto. Por ahora, llama o escribe a {distributor.name}.
        </p>
        <ContactActions distributor={distributor} emphasis="primary" className="mt-5 grid" />
      </div>
    </aside>
  );
}

/** Phone: the one action of the page, within reach of the thumb. */
function ContactBar({ distributor }: { distributor: PublicDistributor }) {
  return (
    <div
      data-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-30 bg-card px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-raised lg:hidden"
    >
      <ContactActions distributor={distributor} emphasis="primary" className="flex-nowrap" />
    </div>
  );
}

type DistributorViewProps = {
  distributor: PublicDistributor;
  /** The moment the page is drawn, to say whether it attends right now. */
  now: Date;
};

/**
 * Public page of one distributor (PLAN 2.5), wearing its colour. It shows only the public
 * profile: nothing about its plan, its trial or who founded it. A profile that does not take
 * orders reaches this page only for its own staff (the rules hand it to nobody else, PLAN
 * 2.11): they see it exactly as visitors will, under a strip that says nobody else does.
 */
export function DistributorView({ distributor, now }: DistributorViewProps) {
  return (
    <BrandTheme color={distributor.brandColor} className="flex flex-1 flex-col pb-24 lg:pb-0">
      {!distributor.acceptingOrders && <PrivatePreviewStrip />}
      <DistributorHero distributor={distributor} status={statusOf(distributor, now)} />
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-7 lg:grid-cols-[minmax(0,1fr)_22.75rem] lg:px-8 lg:pt-6 lg:pb-20">
        <div className="flex min-w-0 flex-col gap-8">
          <Catalog />
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <CoverageCard distributor={distributor} />
            <ScheduleCard distributor={distributor} />
          </div>
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground lg:flex-row lg:justify-between">
            <p className="flex items-center gap-2">
              Página en <HornillaLogo size={FOOT_LOGO_PX} />
            </p>
            <TextLink to={ROUTES.contact}>Reportar esta distribuidora</TextLink>
          </div>
        </div>
        <ContactAside distributor={distributor} />
      </div>
      <ContactBar distributor={distributor} />
    </BrandTheme>
  );
}
