import { cn } from '@/lib/utils';

type BurnerRingProps = {
  /** Size and position: `-top-9 -right-7 size-36`. It must end up cut by an edge or a photo. */
  className: string;
  /** `flame` paints it in the system blue instead of the brand colour. */
  tone?: 'primary' | 'flame';
  /** 10 px stroke, for rings smaller than 180 px. */
  thin?: boolean;
};

/**
 * The dashed ring of the burner peeking from behind a photo or a card (ui-system §9.2).
 * Decorative, one per section at most; its positioned parent needs `relative` and the page
 * container `overflow-x-clip`.
 */
export function BurnerRing({ className, tone = 'primary', thin = false }: BurnerRingProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'burner-ring',
        tone === 'flame' && 'burner-ring-flame',
        thin && 'burner-ring-thin',
        className,
      )}
    />
  );
}
