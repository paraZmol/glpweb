import { describe, expect, it } from 'vitest';
import { inviteMessageOf, invitedRoleOf, whatsappShareHref } from './invite-message';

const LINK = 'https://example.com/unirme#d=seed-dist-a&c=SeedInviteA000000001';

// PLAN 3.2: the owner shares the invitation by WhatsApp, to whomever it chooses there.
describe('invitation message', () => {
  it.each([
    ['owner', 'titular'],
    ['dispatcher', 'parte de la central'],
    ['driver', 'repartidor'],
  ] as const)('names the job of a %s as "%s"', (role, words) => {
    expect(invitedRoleOf(role)).toBe(words);
  });

  it('carries the name of the distributor, the job and the whole link', () => {
    const text = inviteMessageOf('Gas Demo Norte', 'driver', LINK);

    expect(text).toContain('Gas Demo Norte te invita a Hornilla como repartidor.');
    expect(text.endsWith(LINK)).toBe(true);
  });

  it('opens WhatsApp without a number, with the fragment of the link encoded in the text', () => {
    const href = whatsappShareHref(`Hola: ${LINK}`);
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('text')).toBe(`Hola: ${LINK}`);
  });
});
