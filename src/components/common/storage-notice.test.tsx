import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { hasSeenStorageNotice, rememberStorageNoticeSeen } from '../../lib/storage-notice';

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

const BLOCKED = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
} as unknown as Storage;

const NOTICE = 'aria-label="Aviso de almacenamiento"';
const page = () => renderStatic(<p>pantalla</p>);

afterEach(() => vi.unstubAllGlobals());

// PLAN 2.7: informative notice the first time, remembered on the device.
describe('storage notice', () => {
  it('shows the first time, with what is stored, the link to the detail and "Entendido"', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const html = page();
    const notice = html.slice(html.indexOf(NOTICE));

    expect(html).toContain(NOTICE);
    expect(textOf(notice)).toContain('solo lo necesario para funcionar');
    expect(tags(notice, 'a').some((tag) => tag.includes('href="/cookies"'))).toBe(true);
    expect(textOf(notice)).toContain('Entendido');
  });

  it('is information, not a consent panel: nothing to accept, refuse or configure', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const html = page();
    const notice = textOf(html.slice(html.indexOf(NOTICE)));

    expect(tags(html.slice(html.indexOf(NOTICE)), 'button')).toHaveLength(1);
    expect(notice).not.toMatch(/acept|rechaz|configur|consent/i);
    expect(html).not.toContain('role="dialog"');
  });

  // role-walker 2026-10-11: floating over the bottom edge it covered "Guardar cambios", "Usar mi
  // ubicación", "Cerrar sesión" and the decision bar. It is part of the page, before its frame.
  it('is a strip in the flow of the page, above the screen, never a floating layer', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const html = page();
    const [section = ''] = tags(html.slice(html.indexOf('<section')), 'section');

    expect(section).toContain(NOTICE);
    expect(section).not.toMatch(/(fixed|absolute|sticky)/);
    expect(html.indexOf(NOTICE)).toBeLessThan(html.indexOf('pantalla'));
  });

  it('does not come back once it was read on this device', () => {
    vi.stubGlobal('localStorage', fakeStorage());

    expect(hasSeenStorageNotice()).toBe(false);
    rememberStorageNoticeSeen();

    expect(hasSeenStorageNotice()).toBe(true);
    expect(page()).not.toContain(NOTICE);
  });

  it('stays quiet, without failing, when the browser blocks storage', () => {
    vi.stubGlobal('localStorage', BLOCKED);

    expect(hasSeenStorageNotice()).toBe(true);
    expect(() => rememberStorageNoticeSeen()).not.toThrow();
    expect(page()).not.toContain(NOTICE);
  });
});
