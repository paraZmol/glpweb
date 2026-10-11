import { describe, expect, it } from 'vitest';
import { publicDistributorOf, SESSION } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { PermissionDeniedError } from '../../domain/tenancy/errors';
import type { DistributorControl, DistributorPrivateSettings } from '../../domain/tenancy/types';
import type { ListingReview, PendingListing } from '../../features/platform/platform-actions';
import { ListingReviewView } from './listing-review';
import { PendingList } from './pending-list';

// Invented data: the repository is public.
const CREATED = new Date('2026-10-11T20:30:00Z');
const reload = () => {};

const controlOf = (patch: Partial<DistributorControl> = {}): DistributorControl => ({
  ownerUid: 'u-titular',
  status: 'trial',
  trialEndsAt: new Date('2099-01-01T00:00:00Z'),
  listingApproved: false,
  approvedAt: null,
  approvedBy: null,
  reviewNote: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  ...patch,
});

const SETTINGS: DistributorPrivateSettings = {
  ownerUid: 'u-titular',
  ownerName: 'T. Titular',
  ownerPhone: '900000071',
  ownerEmail: 'titular@example.com',
  plan: 'trial',
  taxId: '20000000001',
  legalName: 'Gas Demo Norte S.A.C.',
  hydrocarbonsRegistry: '00000-074-000001',
  terms: null,
  authorityDeclaredAt: null,
  createdAt: CREATED,
  updatedAt: CREATED,
};

const reviewOf = (control: Partial<DistributorControl> = {}): ListingReview => ({
  distributorId: 'abcdefghij0123456789',
  profile: publicDistributorOf({ acceptingOrders: false }),
  control: controlOf(control),
  settings: SETTINGS,
});

const review = (control: Partial<DistributorControl> = {}) =>
  renderStatic(
    <ListingReviewView review={reviewOf(control)} admin={SESSION} onDecided={reload} />,
    { path: '/plataforma/altas/abcdefghij0123456789' },
  );

const buttons = (html: string) =>
  [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)].map(([, label = '']) => textOf(label));

// PLAN 2.11: the listings that wait for the review of the platform.
describe('pending listings', () => {
  const list = (pending: Parameters<typeof PendingList>[0]['pending']) =>
    renderStatic(<PendingList pending={pending} />, { path: '/plataforma' });

  it('says so when nothing waits', () => {
    expect(textOf(list({ status: 'ready', data: [], reload }))).toContain(
      'No hay altas pendientes.',
    );
  });

  it('holds the place of the list while it loads', () => {
    const html = list({ status: 'loading', reload });

    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).toContain('Cargando las altas pendientes');
  });

  it('explains a failure and offers to try again', () => {
    const text = textOf(list({ status: 'error', error: new PermissionDeniedError(), reload }));

    expect(text).toContain('No pudimos cargar las altas pendientes.');
    expect(text).toContain('Reintentar');
  });

  it('lists each one with when it was founded, its state in words and the way to open it', () => {
    const pending: PendingListing[] = [
      { distributorId: 'abcdefghij0123456789', control: controlOf() },
      { distributorId: 'zyxwvutsrq9876543210', control: controlOf({ reviewNote: 'Revisa.' }) },
    ];
    const html = list({ status: 'ready', data: pending, reload });
    const text = textOf(html);

    expect(text).toContain('Alta del 11 oct. 2026, 3:30 p. m.');
    expect(text).toContain('Sin revisar');
    expect(text).toContain('Con cambios pedidos');
    const opened = tags(html, 'a').map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);
    expect(opened.filter((href) => href?.startsWith('/plataforma/'))).toEqual([
      '/plataforma/altas/abcdefghij0123456789',
      '/plataforma/altas/zyxwvutsrq9876543210',
    ]);
  });
});

describe('review of one listing', () => {
  const html = review();
  const text = textOf(html);

  it('shows the public profile as visitors will read it', () => {
    expect(text).toContain('Ficha pública, como se verá');
    expect(text).toContain('Gas Demo Norte');
    expect(text).toContain('/d/gas-demo-norte');
    expect(text).toContain('900 000 011');
    expect(text).toContain('Av. Demo 123');
    expect(text).toContain('5 km desde la planta');
    expect(text).toContain('Lunes a sábado, 7:00 a. m.–8:00 p. m.');
    expect(count(html, /<figure class="(light|dark)"/)).toBe(2);
  });

  it('shows what the founder declared, marked as not public, and who to contact', () => {
    expect(text).toContain('Datos para la revisión (no son públicos)');
    expect(text).toContain('20000000001');
    expect(text).toContain('Gas Demo Norte S.A.C.');
    expect(text).toContain('00000-074-000001');
    expect(text).toContain('T. Titular');
    expect(text).toContain('900 000 071');
    expect(text).toContain('titular@example.com');
  });

  it('links the two public look-ups by their home pages only, as outside links', () => {
    const outside = tags(html, 'a').filter((tag) => tag.includes('href="https://'));

    expect(outside.map((tag) => /href="([^"]+)"/.exec(tag)?.[1])).toEqual([
      'https://www.sunat.gob.pe',
      'https://www.osinergmin.gob.pe',
    ]);
    expect(outside.every((tag) => tag.includes('rel="noopener noreferrer"'))).toBe(true);
    expect(outside.every((tag) => tag.includes('target="_blank"'))).toBe(true);
  });

  it.each([
    ['a new listing', {}, ['Aprobar', 'Pedir cambios', 'Suspender']],
    ['an approved one', { listingApproved: true }, ['Pedir cambios', 'Suspender']],
    [
      'a suspended one',
      { listingApproved: true, status: 'suspended' },
      ['Pedir cambios', 'Reactivar'],
    ],
  ] as const)('offers the decisions that apply to %s', (_case, control, expected) => {
    expect(buttons(review(control))).toEqual(expected);
  });

  it('asks before deciding: no decision is one tap away', () => {
    expect(text).not.toMatch(/Sí, aprobar|Sí, suspender|Enviar nota/);
  });

  it('shows the note that was sent to the owner', () => {
    expect(textOf(review({ reviewNote: 'El registro no figura.' }))).toContain(
      'El registro no figura.',
    );
  });

  it('never calls the distributor verified or authorised', () => {
    for (const control of [{}, { listingApproved: true }, { status: 'suspended' } as const]) {
      expect(textOf(review(control))).not.toMatch(/verificad[ao]|autorizad[ao]/i);
    }
  });
});
