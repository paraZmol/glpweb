import { type ReactNode, useState } from 'react';
import { BrandTheme } from '@/components/brand/brand-theme';
import { Monogram } from '@/components/brand/monogram';
import { Button } from '@/components/common/button';
import { StateChip } from '@/components/common/state-chip';
import { TextLink } from '@/components/common/text-link';
import { BrandPreview } from '@/components/founding/brand-preview';
import type { Session } from '@/domain/auth/session';
import { listingStateOf } from '@/domain/tenancy/listing';
import type { ListingReview } from '@/features/platform/platform-actions';
import { type ReviewAction, reviewActionsOf } from '@/features/platform/review-actions';
import {
  isSameStanding,
  reviewedContentOf,
  standingOf,
} from '@/features/platform/reviewed-content';
import { useReviewAttention } from '@/features/platform/use-review-attention';
import { distributorPath } from '@/lib/routes';
import { ChangedNotice, StandingChangedNotice } from './changed-notice';
import { DECISION_COPY } from './decision-copy';
import { LISTING_LABELS, PLAN_LABELS } from './listing-labels';
import {
  DataList,
  declaredRowsOf,
  holderRowsOf,
  publicRowsOf,
  ReviewSection,
  SourceLinks,
} from './review-data';
import { ReviewDecision } from './review-decision';
import { SentNote } from './sent-note';

type ListingReviewViewProps = {
  review: ListingReview;
  admin: Session;
  /** After a decision: read the listing and the list again. */
  onDecided: () => void;
  /** Said under its name: where the distributor went when it left the list on screen. */
  moved?: ReactNode;
};

/**
 * One listing with everything a platform admin looks at (PLAN 2.11): what visitors will see,
 * what the founder declared, who to contact and the decisions that apply.
 */
export function ListingReviewView({ review, admin, onDecided, moved }: ListingReviewViewProps) {
  const [open, setOpen] = useState<ReviewAction | null>(null);
  // Judged once when the listing is shown: the state does not flip under the reader.
  const [now] = useState(() => new Date());
  const { profile, control, distributorId } = review;
  const listing = LISTING_LABELS[listingStateOf(control, now)];
  const actions = reviewActionsOf(control);
  // The data on screen is live; what an approval is sent for is what the admin looked at.
  const attention = useReviewAttention(review.version, reviewedContentOf(review));
  const showsChanged = attention.needsSecondLook && actions.includes('approve');
  // This view starts again after each decision taken here: a standing that moves under it was
  // moved by somebody else. When the data changed too, that notice already says to look again.
  const [openedAs] = useState(() => standingOf(control));
  const showsStandingChanged = !showsChanged && !isSameStanding(openedAs, control);

  const decided = () => {
    setOpen(null);
    onDecided();
  };
  const refused = () => {
    setOpen(null);
    attention.refuse();
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
              {PLAN_LABELS[control.status]}
            </span>
          </div>
        </div>
      </header>
      {moved}
      {control.reviewNote && (
        <SentNote note={control.reviewNote} correctedAt={control.correctedAt} />
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
      {/* Desktop: the decision stays in reach while the data above is compared. */}
      <section
        aria-label="Decisión"
        className="border-t pt-5 lg:sticky lg:bottom-0 lg:z-10 lg:-mx-7 lg:-mb-7 lg:rounded-b-lg lg:bg-card lg:px-7 lg:pb-7"
      >
        {open ? (
          <ReviewDecision
            key={open}
            action={open}
            admin={admin}
            distributorId={distributorId}
            seen={attention.seen}
            onCancel={() => setOpen(null)}
            onDone={decided}
            onStale={refused}
          />
        ) : (
          <>
            {showsChanged && <ChangedNotice onAcknowledge={attention.acknowledge} />}
            {showsStandingChanged && <StandingChangedNotice />}
            <div className="flex flex-wrap gap-3">
              {actions.map((action) => (
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
          </>
        )}
      </section>
    </div>
  );
}
