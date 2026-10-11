import { ArrowLeft } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/common/button';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { usePlatformDistributors } from '@/features/platform/use-platform-distributors';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useIsDesktop } from '@/lib/use-media-query';
import { DistributorList } from './distributor-list';
import { ListFilter } from './list-filter';
import { FILTER_COPY, filterOf, platformListPath } from './listing-labels';
import { ReviewPane } from './review-pane';

/**
 * `/plataforma` (PLAN 2.11): the distributors of the platform in three lists — the listings that
 * wait for its review (the one it opens on), the approved ones and the suspended ones — and, for
 * the one that is open, everything needed to decide. The list is chosen with `?estado=` and
 * gives the screen its title; a distributor opened by its address brings its own list. Phone:
 * the list, then the distributor on its own screen. Desktop: the list on the left and the
 * distributor beside it. Being here grants nothing: every decision is checked again by the
 * security rules.
 */
export function PlatformHomePage() {
  const { distributorId = null } = useParams();
  const [search] = useSearchParams();
  const filter = filterOf(search);
  const copy = FILTER_COPY[filter];
  usePageTitle(distributorId ? 'Revisar una distribuidora' : copy.title.replace('.', ''));
  const isDesktop = useIsDesktop();
  const list = usePlatformDistributors(filter);
  const showsList = isDesktop || distributorId === null;
  const showsReview = isDesktop || distributorId !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={copy.title}
        lead={copy.lead}
        aside={
          showsList ? (
            <ButtonLink to={ROUTES.account} variant="line" size="sm">
              Revisar mi cuenta
            </ButtonLink>
          ) : (
            <ButtonLink to={platformListPath(filter)} variant="quiet" size="sm">
              <ArrowLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
              Volver a la lista
            </ButtonLink>
          )
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {showsList && (
          // Desktop: the list stays beside the review and scrolls inside its own panel.
          <Panel
            dense
            className="lg:sticky lg:top-[calc(var(--top-inset)+1.5rem)] lg:flex lg:max-h-[calc(100dvh-11rem)] lg:flex-col lg:p-4"
          >
            <ListFilter current={filter} />
            <div className="lg:-mx-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-2 lg:py-1">
              <DistributorList filter={filter} list={list} />
            </div>
          </Panel>
        )}
        {showsReview && (
          <Panel dense>
            <ReviewPane
              key={distributorId}
              distributorId={distributorId}
              filter={filter}
              onDecided={list.reload}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
