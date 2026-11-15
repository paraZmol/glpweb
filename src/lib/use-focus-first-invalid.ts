import { type RefObject, useEffect } from 'react';

/**
 * A field with a message, or a group of choices with one (cards, chips): a group is not a
 * control, so it carries `data-invalid="true"` and `tabIndex={-1}` to take the focus.
 */
const INVALID = '[aria-invalid="true"], [data-invalid="true"]';

/**
 * After a form is rejected, moves the keyboard (and the screen reader) to the first field that
 * has a message, and the screen with it: on a phone the button pressed may be far below. A group
 * is brought to the top (its `scroll-margin` keeps its label in sight). Pass the errors object:
 * the focus moves each time a new one is set.
 */
export function useFocusFirstInvalid(form: RefObject<HTMLElement | null>, errors: object): void {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const first = form.current?.querySelector<HTMLElement>(INVALID);
    if (first?.dataset.invalid !== 'true') return first?.focus();
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'start' });
  }, [form, errors]);
}
