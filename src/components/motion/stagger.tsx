import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { listItemVariants } from '@/lib/motion';

type StaggerProps = {
  /** `ul` and `ol` wrap every child in an `li`. */
  as?: 'div' | 'ul' | 'ol';
  className?: string;
  itemClassName?: string;
  children: ReactNode;
};

/**
 * First appearance of a list or grid: each child fades in and rises 8 px, 40 ms after the
 * previous one, and nothing waits longer than the eighth (motion-system §4).
 */
export function Stagger({ as = 'div', className, itemClassName, children }: StaggerProps) {
  const isReduced = useReducedMotion() ?? false;
  const Item = as === 'div' ? m.div : m.li;

  const items = Children.toArray(children).map((child, index) => {
    const variants = listItemVariants(index, isReduced);
    const key = isValidElement(child) && child.key !== null ? child.key : index;
    return (
      <Item
        key={key}
        className={itemClassName}
        initial={variants.initial}
        animate={variants.animate}
      >
        {child}
      </Item>
    );
  });

  return createElement(as, { className }, items);
}
