import { useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * How long the answers stay deaf after the question appears: longer than a slow double click,
 * so the second click of one never answers a question nobody has read.
 */
export const CONFIRM_ARMING_MS = 600;

type ConfirmPanelProps = {
  /** The question, or the name of what is about to happen. */
  title: string;
  /** What the answer costs, and whatever the answer needs (a note, an error). */
  children: ReactNode;
  /** The answers, in reading order: the way back first, the one that confirms last. */
  actions: ReactNode;
  className?: string;
};

/**
 * The second step of anything that cannot be undone or that leaves the app (ui-system §8): it
 * takes the place of the button that asked. Three things keep a double click, or a tap on a
 * screen that has just moved, from answering it:
 * - it scrolls itself whole into view, clear of the bottom bar, and takes the focus;
 * - its answers sit at the right edge, never where the button that opened it was;
 * - its answers ignore the pointer for `CONFIRM_ARMING_MS` (the keyboard is not held back: the
 *   focus is on the question, not on an answer).
 */
export function ConfirmPanel({ title, children, actions, className }: ConfirmPanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion() ?? false;
  const [isArmed, setArmed] = useState(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    panel.scrollIntoView({ block: 'nearest', behavior: isReduced ? 'auto' : 'smooth' });
    // A field of the question that asked for the focus (the note) keeps it.
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    const timer = setTimeout(() => setArmed(true), CONFIRM_ARMING_MS);
    return () => clearTimeout(timer);
    // Once, when the question appears.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={panelRef}
      role="group"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        'scroll-mt-[calc(var(--top-inset)+1rem)] scroll-mb-[calc(var(--bottom-nav-height)+1rem)]',
        'rounded-lg bg-muted p-4 outline-none focus-visible:outline-3 focus-visible:outline-offset-2',
        'focus-visible:outline-ring focus-visible:outline-solid',
        className,
      )}
    >
      <p id={titleId} className="font-heading text-lg font-bold text-foreground">
        {title}
      </p>
      {children}
      <div
        className={cn('mt-4 flex flex-wrap justify-end gap-3', !isArmed && 'pointer-events-none')}
      >
        {actions}
      </div>
    </div>
  );
}
