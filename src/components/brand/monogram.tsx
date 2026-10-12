import { monogramOf } from '@/domain/brand/monogram';
import { cn } from '@/lib/utils';

type MonogramProps = {
  /** Name of the distributor; its two-letter monogram is drawn. */
  name: string;
  /** `md` is the 48 px square of the spec; `sm` (36 px) fits navigation rows. */
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Stand-in for the logo of a distributor (ui-system §6): a square in its brand colour with two
 * letters. Decorative: the name is always written next to it.
 */
export function Monogram({ name, size = 'md', className }: MonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center bg-primary font-heading font-extrabold tracking-tight text-primary-foreground',
        size === 'md' ? 'size-12 rounded-lg text-lg' : 'size-9 rounded-md text-sm',
        className,
      )}
    >
      {monogramOf(name)}
    </span>
  );
}
