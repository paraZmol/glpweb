import type { ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * One block of a loading screen. Give it the exact size of what is coming (`h-12 w-full`,
 * `h-9 w-2/3`…) so nothing jumps when the data arrives (motion-system §2). Decorative: the
 * container that groups the blocks carries the "loading" announcement (see `LoadingRegion`).
 */
export function Bone({ className, ...props }: ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn('skeleton-shimmer animate-none rounded-sm', className)}
      {...props}
    />
  );
}

type LoadingRegionProps = ComponentProps<'div'> & {
  /** What is loading, for screen readers: "Cargando tu cuenta". */
  label: string;
};

/** Wraps the bones of a screen and tells assistive technology that content is on its way. */
export function LoadingRegion({ label, children, ...props }: LoadingRegionProps) {
  return (
    <div role="status" aria-busy="true" {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
