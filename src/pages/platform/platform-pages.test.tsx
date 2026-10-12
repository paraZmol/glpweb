import { describe, expect, it } from 'vitest';
import { publicDistributorOf, SESSION } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { PermissionDeniedError } from '../../domain/tenancy/errors';
import type { DistributorControl, DistributorPrivateSettings } from '../../domain/tenancy/types';
import type { ListedDistributor, ListingReview } from '../../features/platform/platform-actions';
import type { PlatformDistributors } from '../../features/platform/use-platform-distributors';
import { reviewedContentOf } from '../../features/platform/reviewed-content';
import { MovedNotice } from './changed-notice';
import { DistributorList } from './distributor-list';
import { ListFilter } from './list-filter';
import { filterOf, platformListPath, searchOf } from './listing-labels';
import { ListingReviewView } from './listing-review';

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
  correctedAt: null,
  distributorName: 'Gas Demo Norte',
  slug: 'gas-demo-norte',
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
  version: { profile: '1760214600.000000000', settings: '1760214600.000000000' },
});

const review = (control: Partial<DistributorControl> = {}) =>
  renderStatic(
    <ListingReviewView review={reviewOf(control)} admin={SESSION} onDecided={reload} />,
    { path: '/plataforma/altas/abcdefghij0123456789' },
  );

const buttons = (html: string) =>
  [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)].map(([, label = '']) => textOf(label));

const loaded = (
  items: ListedDistributor[],
  patch: Partial<Extract<PlatformDistributors, { status: 'ready' }>> = {},
): PlatformDistributors => ({
  status: 'ready',
  items,
  hasMore: false,
  isLoadingMore: false,
  loadMoreError: null,
  loadMore: reload,
  reload,
  ...patch,
});

// PLAN 2.11: the lists of the platform panel.
describe('lists of distributors', () => {
  const list = (state: PlatformDistributors, filter: 'inReview' | 'approved' | 'suspended') =>
    renderStatic(<DistributorList filter={filter} list={state} />, { path: '/plataforma' });
  const opened = (html: string) =>
    tags(html, 'a')
      .map((tag) => /href="([^"]+)"/.exec(tag)?.[1])
      .filter((href) => href?.startsWith('/plataforma/'));

  it.each([
    ['inReview', 'No hay altas pendientes.'],
    ['approved', 'Todavía no hay distribuidoras aprobadas.'],
    ['suspended', 'No hay distribuidoras suspendidas.'],
  ] as const)('says so when the %s list is empty', (filter, expected) => {
    expect(textOf(list(loaded([]), filter))).toContain(expected);
  });

  it('holds the place of the list while it loads', () => {
    const html = list({ status: 'loading', reload }, 'inReview');

    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).toContain('Cargando la lista');
  });

  it('explains a failure and offers to try again', () => {
    const failed = { status: 'error', error: new PermissionDeniedError(), reload } as const;
    const text = textOf(list(failed, 'inReview'));

    expect(text).toContain('No pudimos cargar esta lista.');
    expect(text).toContain('Reintentar');
  });

  it('lists each one by name, with its link, when it was founded, its state and the way in', () => {
    const waiting: ListedDistributor[] = [
      { distributorId: 'abcdefghij0123456789', control: controlOf() },
      {
        distributorId: 'zyxwvutsrq9876543210',
        control: controlOf({ distributorName: 'Gas Demo Sur', reviewNote: 'Revisa.' }),
      },
      {
        distributorId: 'mnopqrstuv5555555555',
        control: controlOf({ reviewNote: 'Revisa.', correctedAt: CREATED }),
      },
    ];
    const html = list(loaded(waiting), 'inReview');
    const text = textOf(html);

    expect(text).toContain('Gas Demo Norte');
    expect(text).toContain('Gas Demo Sur');
    expect(text).toContain('/d/gas-demo-norte');
    expect(text).toContain('Alta del 11 oct. 2026, 3:30 p. m.');
    expect(text).toContain('Identificador abcdefghij0123456789');
    expect(text).toContain('Sin revisar');
    expect(text).toContain('Con cambios pedidos');
    expect(text).toContain('Correcciones enviadas');
    expect(opened(html)).toEqual([
      '/plataforma/altas/abcdefghij0123456789',
      '/plataforma/altas/zyxwvutsrq9876543210',
      '/plataforma/altas/mnopqrstuv5555555555',
    ]);
  });

  // CLAUDE.md rule 10: a control document older than the copies still lists.
  it('lists a distributor whose control document has no name yet by when it was founded', () => {
    const legacy = controlOf({ distributorName: null, slug: null });
    const text = textOf(
      list(loaded([{ distributorId: 'abcdefghij0123456789', control: legacy }]), 'inReview'),
    );

    expect(text).toContain('Alta del 11 oct. 2026, 3:30 p. m.');
    expect(text).toContain('Sin nombre en la lista');
    expect(text).toContain('Identificador abcdefghij0123456789');
  });

  it('says in words that a listed distributor is suspended, and keeps the list in the link', () => {
    const suspended = controlOf({ status: 'suspended', listingApproved: true });
    const html = list(
      loaded([{ distributorId: 'abcdefghij0123456789', control: suspended }]),
      'suspended',
    );

    expect(textOf(html)).toContain('Aprobada, sin operar');
    expect(textOf(html)).toContain('Suspendida');
    expect(opened(html)).toEqual(['/plataforma/altas/abcdefghij0123456789?estado=suspendidas']);
  });

  it('offers the next page only while there is one', () => {
    const rows = [{ distributorId: 'abcdefghij0123456789', control: controlOf() }];

    expect(buttons(list(loaded(rows), 'approved'))).toEqual([]);
    expect(buttons(list(loaded(rows, { hasMore: true }), 'approved'))).toEqual(['Cargar más']);
  });

  it('keeps the rows and says so when the next page fails', () => {
    const rows = [{ distributorId: 'abcdefghij0123456789', control: controlOf() }];
    const failed = loaded(rows, { hasMore: true, loadMoreError: new Error('boom') });
    const text = textOf(list(failed, 'approved'));

    expect(text).toContain('Gas Demo Norte');
    expect(text).toContain('No pudimos cargar más.');
  });
});

describe('choice of list', () => {
  it('offers the three lists as links and marks the one on screen', () => {
    const html = renderStatic(<ListFilter current="approved" />, { path: '/plataforma' });
    const links = tags(html, 'a').filter((tag) => tag.includes('href="/plataforma'));

    expect(links.map((tag) => /href="([^"]+)"/.exec(tag)?.[1])).toEqual([
      '/plataforma',
      '/plataforma?estado=aprobadas',
      '/plataforma?estado=suspendidas',
    ]);
    expect(links.map((tag) => tag.includes('aria-current="true"'))).toEqual([false, true, false]);
    expect(textOf(html)).toContain('En revisión');
  });

  it.each([
    ['', 'inReview'],
    ['estado=aprobadas', 'approved'],
    ['estado=suspendidas', 'suspended'],
    ['estado=todas', 'inReview'],
    ['estado=', 'inReview'],
  ] as const)('reads "%s" in the address as the %s list', (search, expected) => {
    expect(filterOf(new URLSearchParams(search))).toBe(expected);
  });

  it.each(['inReview', 'approved', 'suspended'] as const)(
    'writes the %s list in the address so that it reads back the same',
    (filter) => {
      expect(filterOf(new URLSearchParams(searchOf(filter)))).toBe(filter);
      expect(platformListPath(filter).startsWith('/plataforma')).toBe(true);
    },
  );
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

  // PLAN 2.11: the owner answered the note; the admin sees both the note and the answer.
  it('says when the owner sent corrections, next to the note it answers', () => {
    const answered = textOf(review({ reviewNote: 'El registro no figura.', correctedAt: CREATED }));

    expect(answered).toContain('Correcciones enviadas');
    expect(answered).toContain('El registro no figura.');
    expect(answered).toContain('Su titular envió correcciones el 11 oct. 2026, 3:30 p. m.');
    expect(buttons(review({ reviewNote: 'x', correctedAt: CREATED }))).toEqual([
      'Aprobar',
      'Pedir cambios',
      'Suspender',
    ]);
  });

  it('does not speak of corrections while the owner has not answered', () => {
    expect(textOf(review({ reviewNote: 'El registro no figura.' }))).not.toContain('correcciones');
  });

  it('never calls the distributor verified or authorised', () => {
    for (const control of [{}, { listingApproved: true }, { status: 'suspended' } as const]) {
      expect(textOf(review(control))).not.toMatch(/verificad[ao]|autorizad[ao]/i);
    }
  });
});

// B4 (role-walker 2026-10-12): what counts as "the listing changed" for the admin who reviews.
describe('reviewedContentOf', () => {
  const opened = reviewOf();

  it('is the same after a suspension: it only stamps the profile and closes it to orders', () => {
    const suspended: ListingReview = {
      ...opened,
      profile: {
        ...opened.profile,
        acceptingOrders: !opened.profile.acceptingOrders,
        updatedAt: new Date('2026-10-12T10:00:00Z'),
      },
      settings: { ...opened.settings, updatedAt: new Date('2026-10-12T10:00:00Z') },
      control: controlOf({ status: 'suspended' }),
    };

    expect(reviewedContentOf(suspended)).toBe(reviewedContentOf(opened));
  });

  type Edit = { profile?: Partial<ListingReview['profile']>; settings?: Partial<typeof SETTINGS> };
  const EDITS: [string, Edit][] = [
    ['the name', { profile: { name: 'Gas Demo Sur' } }],
    ['a phone', { profile: { contactPhone: '900000012' } }],
    ['the address', { profile: { addressLine: 'Av. Demo 456' } }],
    ['the plant', { profile: { plant: { lat: -12.06, lng: -77.04 } } }],
    ['the colour', { profile: { brandColor: '#1757d6' } }],
    ['the schedule', { profile: { schedule: { days: [1], opensAt: '08:00', closesAt: '12:00' } } }],
    ['the tax number', { settings: { taxId: '20000000002' } }],
    ['the legal name', { settings: { legalName: 'Otra S.A.C.' } }],
    ['the record number', { settings: { hydrocarbonsRegistry: '00000-074-000002' } }],
    ['the phone of the holder', { settings: { ownerPhone: '900000072' } }],
  ];
  it.each(EDITS)('differs when %s changes', (_what, patch) => {
    const edited: ListingReview = {
      ...opened,
      profile: { ...opened.profile, ...patch.profile },
      settings: { ...opened.settings, ...patch.settings },
    };

    expect(reviewedContentOf(edited)).not.toBe(reviewedContentOf(opened));
  });
});

describe('a distributor that left the list it was opened from', () => {
  it('says where it is now, with the way to that list keeping it open', () => {
    const html = renderStatic(
      <MovedNotice distributorId="abcdefghij0123456789" from="inReview" to="approved" />,
      { path: '/plataforma/altas/abcdefghij0123456789' },
    );

    expect(textOf(html)).toContain(
      'Ya no está en la lista «En revisión»: ahora figura en Aprobadas',
    );
    expect(html).toContain('href="/plataforma/altas/abcdefghij0123456789?estado=aprobadas"');
  });
});
