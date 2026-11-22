import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { enterTransition, listItemVariants, REVEAL_VIEWPORT } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type TimelineStep = { title: string; text?: string };

type StepsTimelineProps = {
  steps: readonly TimelineStep[];
  /** `row`: a column on the phone and a row on desktop; `column`: a column everywhere. */
  layout: 'row' | 'column';
  className?: string;
};

const LINE = 'pointer-events-none absolute bg-primary/40';
// The line runs through the centre of the numbers (size-11 inside a p-4 card).
const VERTICAL = `${LINE} top-8 bottom-8 left-[calc(1rem+1.375rem-1px)] w-0.5 origin-top`;
const HORIZONTAL = `${LINE} top-1/2 right-8 left-8 h-0.5 -translate-y-1/2 origin-left`;

const growY = { hidden: { scaleY: 0 }, shown: { scaleY: 1, transition: enterTransition('slow') } };
const growX = { hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: enterTransition('slow') } };

/**
 * Numbered steps joined by a line (docs/marketing/movimiento-portada.md): when the list scrolls
 * into view the numbers arrive in order and the line grows, down on the phone and across on a
 * desktop row. Once. With reduced motion everything is in place, line complete.
 */
export function StepsTimeline({ steps, layout, className }: StepsTimelineProps) {
  const isReduced = useReducedMotion() ?? false;
  const isRow = layout === 'row';
  const animated = !isReduced;

  return (
    <m.div
      className={cn('relative', className)}
      {...(animated && { initial: 'hidden', whileInView: 'shown', viewport: REVEAL_VIEWPORT })}
    >
      <m.span
        aria-hidden="true"
        className={cn(VERTICAL, isRow && 'lg:hidden')}
        variants={animated ? growY : undefined}
      />
      {isRow && (
        <m.span
          aria-hidden="true"
          className={cn(HORIZONTAL, 'hidden lg:block')}
          variants={animated ? growX : undefined}
        />
      )}
      <ol className={cn('relative grid gap-3', isRow && 'lg:grid-cols-3 lg:gap-6')}>
        {steps.map((step, index) => {
          const variants = listItemVariants(index, false);
          return (
            <m.li
              key={step.title}
              variants={
                animated ? { hidden: variants.initial, shown: variants.animate } : undefined
              }
              className={cn(
                'relative flex gap-4 rounded-xl bg-muted p-4',
                step.text ? 'items-start' : 'items-center',
                isRow && 'lg:p-6',
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft font-heading text-xl font-extrabold text-primary-text tabular-nums">
                {index + 1}
              </span>
              {step.text ? (
                <div>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground">{step.text}</p>
                </div>
              ) : (
                <span className="text-lg font-semibold">{step.title}</span>
              )}
            </m.li>
          );
        })}
      </ol>
    </m.div>
  );
}
