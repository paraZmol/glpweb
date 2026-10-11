import { Copy, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { StateChip, type SystemState } from '@/components/common/state-chip';
import { TextLink } from '@/components/common/text-link';
import { Panel } from '@/components/layout/page-header';
import type { ListingState } from '@/domain/tenancy/listing';
import type { Distributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath, ROUTES } from '@/lib/routes';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { VerificationCorrection } from './verification-correction';

// PLAN 2.11. The platform looks at what was declared: no state here says "verificada".
const STATES: Record<ListingState, { chip: string; state: SystemState; text: string }> = {
  inReview: {
    chip: 'En revisión',
    state: 'paused',
    text: 'Estamos revisando tus datos. Mientras tanto puedes preparar tu catálogo; tus clientes todavía no te ven.',
  },
  changesRequested: {
    chip: 'Cambios pedidos',
    state: 'danger',
    text: 'Hornilla revisó tu distribuidora y te pide corregir algo antes de mostrarla. Tus clientes todavía no te ven.',
  },
  correctionsSent: {
    chip: 'Correcciones enviadas',
    state: 'paused',
    text: 'Recibimos tus correcciones y las estamos revisando de nuevo. Tus clientes todavía no te ven.',
  },
  listed: {
    chip: 'Visible en el buscador',
    state: 'free',
    text: 'Tus clientes ya te encuentran en el buscador y en tu enlace.',
  },
  notOperating: {
    chip: 'Sin operar',
    state: 'offline',
    text: 'Hornilla ya revisó tus datos, pero tu distribuidora está en solo lectura: no aparece en el buscador ni en tu enlace hasta regularizar el plan.',
  },
};

function publicUrlOf(slug: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${distributorPath(slug)}`;
}

/** The link customers use, to open it or to copy it and share it. */
function PublicLink({ slug }: { slug: string }) {
  const url = publicUrlOf(slug);
  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado.'),
      () => toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.'),
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        to={distributorPath(slug)}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md font-semibold wrap-anywhere text-primary-text underline underline-offset-4"
      >
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE} />
        {url}
      </Link>
      <Button type="button" variant="line" size="sm" onClick={copy}>
        <Copy aria-hidden="true" strokeWidth={ICON_STROKE} />
        Copiar enlace
      </Button>
    </div>
  );
}

type ListingStatusProps = {
  distributor: Distributor;
  listing: ListingState;
  /** Owners may edit the public profile. */
  isOwner: boolean;
  /** Only whoever founded it can read and correct the verification data. */
  isFounder: boolean;
  /** After the founder corrected its data: the state of the listing changed. */
  onCorrected?: () => void;
};

/** The platform left a note: it stays on screen until the platform decides again. */
const hasNote = (listing: ListingState) =>
  listing === 'changesRequested' || listing === 'correctionsSent';

function actionsOf(props: ListingStatusProps): ReactNode {
  const { distributor, listing, isOwner, isFounder, onCorrected } = props;
  if (listing === 'listed') return <PublicLink slug={distributor.slug} />;
  if (!hasNote(listing) || !isOwner) return null;
  return (
    <>
      {isFounder ? (
        <VerificationCorrection distributorId={distributor.id} onCorrected={onCorrected} />
      ) : (
        <p className="text-muted-foreground">
          El RUC, la razón social y el registro los corrige quien registró la distribuidora.
        </p>
      )}
      <p className="text-muted-foreground">
        Si lo que hay que corregir es el nombre, un teléfono o la dirección,{' '}
        <TextLink to={ROUTES.officeProfile}>edita tu ficha</TextLink>.
      </p>
    </>
  );
}

/**
 * Where the distributor stands with the review of the platform (PLAN 2.11), at the top of the
 * office: waiting, sent back with a note, corrected and waiting again, listed (with its link) or
 * approved but not operating.
 */
export function ListingStatus(props: ListingStatusProps) {
  const { distributor, listing } = props;
  const { chip, state, text } = STATES[listing];
  const isHeldByPlatform = listing === 'notOperating' && isSuspended(distributor.status);
  const actions = actionsOf(props);
  return (
    <Panel dense>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-lg font-bold">Tu ficha en Hornilla</h2>
        <StateChip state={state}>{chip}</StateChip>
      </div>
      <p className="mt-2 max-w-prose text-muted-foreground">
        {isHeldByPlatform ? <SuspendedNotice /> : text}
      </p>
      {hasNote(listing) && distributor.reviewNote && (
        <figure className="mt-3 rounded-lg bg-muted p-3.5">
          <figcaption className="text-[0.8125rem] font-bold text-muted-foreground">
            Nota de Hornilla
          </figcaption>
          <blockquote className="mt-1 font-semibold wrap-anywhere whitespace-pre-line">
            {distributor.reviewNote}
          </blockquote>
        </figure>
      )}
      {actions && <div className="mt-4 flex flex-col gap-3">{actions}</div>}
    </Panel>
  );
}
