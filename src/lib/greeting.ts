const ENDS_A_SENTENCE = /[.!?…]$/;

function firstNameOf(displayName: string | null | undefined): string {
  return displayName?.trim().split(/\s+/)[0] ?? '';
}

/**
 * "Hola, Ana." for the home of the customer, by first name. A name that already ends its own
 * sentence ("Z.", an initial) is not given a second full stop.
 */
export function greetingFor(displayName: string | null | undefined): string {
  const firstName = firstNameOf(displayName);
  if (firstName === '') return 'Hola.';
  return `Hola, ${firstName}${ENDS_A_SENTENCE.test(firstName) ? '' : '.'}`;
}
