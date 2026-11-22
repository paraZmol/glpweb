import { describe, expect, it, vi } from 'vitest';
import {
  canShareThroughDevice,
  inviteMessageOf,
  inviteShareDataOf,
  invitedRoleOf,
  shareThroughDevice,
  whatsappShareHref,
} from './invite-message';

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

// PLAN §11 (2026-10-16): the share sheet of the device first, so the link goes from the phone
// to the app the owner picks; wa.me only where there is none.
describe('sharing through the device', () => {
  const DATA = inviteShareDataOf('Gas Demo Norte', 'driver', LINK);
  const abort = () => Object.assign(new Error('closed'), { name: 'AbortError' });

  it('hands the sheet the text and the link apart, the link only once', () => {
    expect(DATA.url).toBe(LINK);
    expect(DATA.text).toContain('Gas Demo Norte te invita a Hornilla como repartidor.');
    expect(DATA.text).not.toContain(LINK);
  });

  it.each([
    ['a device without a share sheet', {}, false],
    ['a device that cannot share this', { share: vi.fn(), canShare: () => false }, false],
    ['a device that can', { share: vi.fn(), canShare: () => true }, true],
    ['a device that shares without saying what it can', { share: vi.fn() }, true],
  ])('offers the sheet on %s: %s', (_case, device, expected) => {
    expect(canShareThroughDevice(device, DATA)).toBe(expected);
  });

  it('shares through the sheet with the data of the invitation', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    expect(await shareThroughDevice({ share }, DATA)).toBe('shared');
    expect(share).toHaveBeenCalledWith(DATA);
  });

  it('reads closing the sheet as cancelled, not as a failure', async () => {
    const share = vi.fn().mockRejectedValue(abort());
    expect(await shareThroughDevice({ share }, DATA)).toBe('cancelled');
  });

  it.each([
    ['the sheet refuses', { share: vi.fn().mockRejectedValue(new Error('NotAllowedError')) }],
    ['there is no sheet', {}],
  ])('fails when %s', async (_case, device) => {
    expect(await shareThroughDevice(device, DATA)).toBe('failed');
  });
});
