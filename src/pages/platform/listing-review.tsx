import { useState } from 'react';
import { BrandTheme } from '@/components/brand/brand-theme';
import { Monogram } from '@/components/brand/monogram';
import { Button } from '@/components/common/button';
import { StateChip, type SystemState } from '@/components/common/state-chip';
import { TextLink } from '@/components/common/text-link';
import { BrandPreview } from '@/components/founding/brand-preview';
import type { Session } from '@/domain/auth/session';
import { type ListingState, listingStateOf } from '@/domain/tenancy/listing';
import type { DistributorStatus } from '@/domain/tenancy/types';
import type { ListingReview } from '@/features/platform/platform-actions';
import { type ReviewAction, reviewActionsOf } from '@/features/platform/review-actions';
import { distributorPath } from '@/lib/routes';
import { DECISION_COPY } from './decision-copy';
import {
  DataList,
  declaredRowsOf,
  holderRowsOf,
  publicRowsOf,
  ReviewSection,
  SourceLinks,
} from './review-data';
import { ReviewDecision } from './review-decision';

const LISTING: Record<ListingState, { text: string; state: SystemState }> = {
  inReview: { text: 'Sin revisar', state: 'paused' },
  changesRequested: { text: 'Con cambios pedidos', state: 'danger' },
  listed: { text: 'Aprobada y visible', state: 'free' },
  notOperating: { text: 'Aprobada, sin operar', state: 'offline' },
};
const PLAN: Record<DistributorStatus, string> = {
  trial: 'En prueba',
  active: 'Plan activo',
  pastDue: 'Pago pendiente',
  suspended: 'Suspendida',
};

type ListingReviewViewProps = {
  review: ListingReview;
  admin: Session;
  /** After a decision: read the listing and the list again. */
  onDecided: () => void;
};

/**
 * One listing with everything a platform admin looks at (PLAN 2.11): what visitors will see,
 * what the founder declared, who to contact and the decisions that apply.
 */
export function ListingReviewView({ review, admin, onDecided }: ListingReviewViewProps) {
  const [open, setOpen] = useState<ReviewAction | null>(null);
  // Judged once when the listing is shown: the state does not flip under the reader.
  const [now] = useState(() => new Date());
  const { profile, control, distributorId } = review;
  const listing = LISTING[listingStateOf(control, now)];

  const decided = () => {
    setOpen(null);
    onDecided();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <BrandTheme color={profile.brandColor}>
          <Monogram name={profile.name} />
        </BrandTheme>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold wrap-anywhere">{profile.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <StateChip state={listing.state}>{listing.text}</StateChip>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[0.8125rem] font-bold text-muted-foreground">
              {PLAN[control.status]}
            </span>
          </div>
        </div>
      </header>
      {control.reviewNote && (
        <figure className="rounded-lg bg-muted p-3.5">
          <figcaption className="text-[0.8125rem] font-bold text-muted-foreground">
            Nota enviada a su titular
          </figcaption>
          <blockquote className="mt-1 font-semibold wrap-anywhere whitespace-pre-line">
            {control.reviewNote}
          </blockquote>
        </figure>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <ReviewSection title="Ficha pública, como se verá">
          <DataList rows={publicRowsOf(review)} />
          <BrandPreview stacked color={profile.brandColor} name={profile.name} className="mt-3" />
          <p className="mt-3">
            <TextLink to={distributorPath(profile.slug)} newTab>
              Abrir su página
            </TextLink>
          </p>
        </ReviewSection>
        <div className="flex flex-col gap-6">
          <ReviewSection title="Datos para la revisión (no son públicos)">
            <DataList rows={declaredRowsOf(review)} />
            <SourceLinks />
          </ReviewSection>
          <ReviewSection title="Contacto de quien la registró">
            <DataList rows={holderRowsOf(review)} />
          </ReviewSection>
        </div>
      </div>
      <section aria-label="Decisión" className="border-t pt-5">
        {open ? (
          <ReviewDecision
            key={open}
            action={open}
            admin={admin}
            distributorId={distributorId}
            onCancel={() => setOpen(null)}
            onDone={decided}
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {reviewActionsOf(control).map((action) => (
              <Button
                key={action}
                type="button"
                size="sm"
                variant={DECISION_COPY[action].variant}
                onClick={() => setOpen(action)}
              >
                {DECISION_COPY[action].label}
              </Button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
