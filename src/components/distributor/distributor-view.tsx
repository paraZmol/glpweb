import { BrandTheme } from '@/components/brand/brand-theme';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { OutsideLink } from '@/components/common/outside-link';
import { TextLink } from '@/components/common/text-link';
import { complaintsBookHostOf } from '@/domain/tenancy/complaints-book';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { describeOpenStatus, openStatusAt } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ROUTES } from '@/lib/routes';
import { ContactActions } from './contact-actions';
import { CoverageCard, ScheduleCard } from './distributor-details';
import { DistributorHero } from './distributor-hero';
import { DistributorProducts } from './distributor-products';
import { PrivatePreviewStrip } from './private-preview-strip';

const FOOT_LOGO_PX = 20;

function statusOf(distributor: PublicDistributor, now: Date) {
  if (!distributor.acceptingOrders) return { isOpen: false, text: 'Ahora no es pública' };
  const open = openStatusAt(distributor.schedule, now, DEFAULT_TIMEZONE);
  return { isOpen: open.isOpen, text: describeOpenStatus(open) };
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

/**
 * Its own virtual book (PLAN §11, 2026-10-15), a site Hornilla does not review: the host stays
 * in sight next to the link, so a visitor sees where it leads before opening it (2026-10-16).
 */
function ComplaintsBookLink({ url, name }: { url: string; name: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5">
      <OutsideLink href={url}>Libro de Reclamaciones de {name}</OutsideLink>
      <span className="break-all">· {complaintsBookHostOf(url)}</span>
    </span>
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
          <DistributorProducts distributorId={distributor.id} />
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <CoverageCard distributor={distributor} />
            <ScheduleCard distributor={distributor} />
          </div>
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground lg:flex-row lg:justify-between">
            <p className="flex items-center gap-2">
              Página en <HornillaLogo size={FOOT_LOGO_PX} />
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
              {/* Its own virtual book, when it gave the link (PLAN §11, 2026-10-15). */}
              {distributor.complaintsBookUrl && (
                <ComplaintsBookLink url={distributor.complaintsBookUrl} name={distributor.name} />
              )}
              <TextLink to={ROUTES.contact}>Reportar esta distribuidora</TextLink>
            </div>
          </div>
        </div>
        <ContactAside distributor={distributor} />
      </div>
      <ContactBar distributor={distributor} />
    </BrandTheme>
  );
}
