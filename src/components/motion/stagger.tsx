import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { Children, isValidElement, type ReactNode } from 'react';
import { listItemVariants, REVEAL_VIEWPORT } from '@/lib/motion';

type StaggerProps = {
  /** `ul` and `ol` wrap every child in an `li`. */
  as?: 'div' | 'ul' | 'ol';
  /**
   * Waits until the list scrolls into view (once, 15 % visible) instead of animating on mount:
   * for sections below the first view. With reduced motion the list is simply there.
   */
  inView?: boolean;
  className?: string;
  itemClassName?: string;
  children: ReactNode;
};

const CONTAINERS = { div: m.div, ul: m.ul, ol: m.ol } as const;

/**
 * First appearance of a list or grid: each child fades in and rises 8 px, 40 ms after the
 * previous one, and nothing waits longer than the eighth (motion-system §4). One observer per
 * list: the container watches the viewport and its items follow by variant name.
 */
export function Stagger({
  as = 'div',
  inView = false,
  className,
  itemClassName,
  children,
}: StaggerProps) {
  const isReduced = useReducedMotion() ?? false;
  const Container = CONTAINERS[as];
  const Item = as === 'div' ? m.div : m.li;
  const isStill = inView && isReduced;

  const items = Children.toArray(children).map((child, index) => {
    const variants = listItemVariants(index, isReduced);
    const key = isValidElement(child) && child.key !== null ? child.key : index;
    return (
      <Item
        key={key}
        className={itemClassName}
        variants={isStill ? undefined : { hidden: variants.initial, shown: variants.animate }}
      >
        {child}
      </Item>
    );
  });

  if (isStill) return <Container className={className}>{items}</Container>;
  return (
    <Container
      className={className}
      initial="hidden"
      {...(inView ? { whileInView: 'shown', viewport: REVEAL_VIEWPORT } : { animate: 'shown' })}
    >
      {items}
    </Container>
  );
}
