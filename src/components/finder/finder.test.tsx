import { describe, expect, it } from 'vitest';
import { publicDistributorOf } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { OfflineError } from '../../domain/tenancy/errors';
import type { NearbyDistributor } from '../../domain/tenancy/nearby';
import type { AsyncResource } from '../../lib/use-async-resource';
import { ResultsView } from './results-view';

// 2026-10-10 is a Saturday; noon in Lima.
const NOW = new Date('2026-10-10T17:00:00Z');
const NEAR: NearbyDistributor = {
  distributor: publicDistributorOf({
    id: 'd-norte',
    brands: ['Marca Uno', 'Marca Dos'],
    priceFromCents: 3800,
  }),
  distanceKm: 1.112,
};
const FAR: NearbyDistributor = {
  distributor: publicDistributorOf({
    id: 'd-sur',
    name: 'Gas Demo Sur',
    slug: 'gas-demo-sur',
    schedule: { days: [1, 2, 3, 4, 5], opensAt: '07:00', closesAt: '20:00' },
  }),
  distanceKm: 2.3,
};

function view(resource: AsyncResource<NearbyDistributor[]>, isOnline = true): string {
  return renderStatic(
    <ResultsView resource={resource} isOnline={isOnline} onRetry={() => {}} now={NOW} />,
  );
}

// PLAN 2.6: every state of the search has its own shape.
describe('results of the finder (PLAN 2.6)', () => {
  it('asks for a location while there is none', () => {
    expect(textOf(view({ status: 'idle' }))).toContain('Dinos dónde y vemos quién llega.');
  });

  it('holds the place with skeletons while it searches', () => {
    const html = view({ status: 'loading' });

    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).toContain('Buscando distribuidoras cerca de ti');
  });

  it('lists who reaches the point, each with its distance, its state and the way to its page', () => {
    const html = view({ status: 'ready', data: [NEAR, FAR] });
    const text = textOf(html);

    expect(count(html, /<article\b/)).toBe(2);
    expect(text.indexOf('Gas Demo Norte')).toBeLessThan(text.indexOf('Gas Demo Sur'));
    expect(text).toContain('a 1,1 km de tu punto');
    expect(text).toContain('Abierto · cierra a las 8:00 p. m.');
    expect(text).toContain('Cerrado · abre el lunes a las 7:00 a. m.');
    expect(tags(html, 'a').map((tag) => /href="([^"]+)"/.exec(tag)?.[1])).toEqual([
      '#contenido',
      '/d/gas-demo-norte',
      '/d/gas-demo-sur',
    ]);
  });

  it('shows brands and the "desde" price only when the profile carries them', () => {
    const text = textOf(view({ status: 'ready', data: [NEAR, FAR] }));

    expect(text).toContain('Marca Uno · Marca Dos');
    expect(text).toContain('Recarga desde S/ 38.00');
    expect(count(text, /Recarga desde/)).toBe(1);
    expect(text).toContain('Todavía no publicó su catálogo.');
  });

  it('gives each card the colour of its distributor', () => {
    expect(count(view({ status: 'ready', data: [NEAR, FAR] }), /data-brand=""/)).toBe(2);
  });

  it('sums the search up next to the place of the map', () => {
    const text = textOf(view({ status: 'ready', data: [NEAR, FAR] }));

    expect(text).toContain('2 distribuidoras te cubren.');
    expect(text).toContain('La más cercana está a 1,1 km de tu punto.');
  });

  it('says nobody covers the point and invites to tell the usual distributor', () => {
    const html = view({ status: 'ready', data: [] });
    const invite = tags(html, 'a').find((tag) => tag.includes('https://wa.me/?text=')) ?? '';

    expect(textOf(html)).toContain('Todavía no hay distribuidoras en tu zona.');
    expect(decodeURIComponent(invite)).toContain('/distribuidora/nueva');
    expect(invite).toContain('rel="noopener noreferrer"');
  });

  it('explains a failed search and offers to retry', () => {
    const text = textOf(view({ status: 'error', error: new Error('boom') }));

    expect(text).toContain('No pudimos buscar distribuidoras.');
    expect(text).toContain('Reintentar');
  });

  it.each([
    ['the device is offline', new Error('boom'), false],
    ['the repository reports no connection', new OfflineError(), true],
  ])('says there is no connection when %s', (_case, error, isOnline) => {
    expect(textOf(view({ status: 'error', error }, isOnline))).toContain('Sin conexión.');
  });
});
