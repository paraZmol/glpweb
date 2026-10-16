import { Hourglass } from 'lucide-react';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

/** Marks what is announced but not built yet (PLAN 3.6): never presented as available. */
export function SoonStamp({ label = 'Pronto', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-aji px-3 py-1 text-[0.8125rem] font-bold text-aji-foreground',
        className,
      )}
    >
      <Hourglass aria-hidden="true" className="size-4" strokeWidth={GLYPH_STROKE} />
      {label}
    </span>
  );
}
