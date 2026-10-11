import { Link } from 'react-router';
import { PLATFORM_LIST_FILTERS, type PlatformListFilter } from '@/domain/tenancy/listing';
import { cn } from '@/lib/utils';
import { FILTER_COPY, platformListPath } from './listing-labels';

/** The three lists of the panel. Links, so the choice lives in the address and survives a visit. */
export function ListFilter({ current }: { current: PlatformListFilter }) {
  return (
    <nav aria-label="Listas de distribuidoras" className="mb-3 flex flex-wrap gap-2">
      {PLATFORM_LIST_FILTERS.map((filter) => (
        <Link
          key={filter}
          to={platformListPath(filter)}
          aria-current={filter === current ? 'true' : undefined}
          className={cn(
            'rounded-full px-3 py-1.5 text-[0.8125rem] font-bold transition-colors motion-fast',
            filter === current
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {FILTER_COPY[filter].tab}
        </Link>
      ))}
    </nav>
  );
}
