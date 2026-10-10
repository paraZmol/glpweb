import { Map as MapIcon } from 'lucide-react';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

type MapGapProps = {
  /** Size of the gap: `h-90`, `aspect-4/3`… */
  className?: string;
  /** Short label of the stamp. */
  label?: string;
};

/**
 * The place where a map will go (phase 6), drawn as what it is: a gap. A coverage circle and
 * the point at its centre say what the map will show; there are no streets nor tiles, so nobody
 * takes it for a real map. Decorative: the text next to it carries the information.
 */
export function MapGap({ className, label = 'Mapa en camino' }: MapGapProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-input bg-muted',
        className,
      )}
    >
      <svg viewBox="0 0 200 200" className="h-4/5 max-h-72 w-auto">
        <circle
          cx="100"
          cy="100"
          r="92"
          strokeWidth="2"
          strokeDasharray="6 7"
          className="fill-primary/8 stroke-primary/70"
        />
        <circle cx="100" cy="100" r="9" strokeWidth="3" className="fill-flame stroke-card" />
      </svg>
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[0.8125rem] font-bold text-muted-foreground shadow-card">
        <MapIcon className="size-3.5" strokeWidth={GLYPH_STROKE} />
        {label}
      </span>
    </div>
  );
}
