import { type RefObject, useEffect } from 'react';

const INVALID_CONTROL = '[aria-invalid="true"]';

/**
 * After a form is rejected, moves the keyboard (and the screen reader) to the first field that
 * has a message. Pass the errors object: the focus moves each time a new one is set.
 */
export function useFocusFirstInvalid(form: RefObject<HTMLElement | null>, errors: object): void {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    form.current?.querySelector<HTMLElement>(INVALID_CONTROL)?.focus();
  }, [form, errors]);
}
