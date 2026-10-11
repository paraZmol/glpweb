import { describe, expect, it } from 'vitest';
import {
  accountOf,
  distributorOf,
  memberOf,
  SESSION,
  workingAs,
} from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { AppShell } from '../../components/layout/app-shell';
import type { ListingState } from '../../domain/tenancy/listing';
import type { Distributor } from '../../domain/tenancy/types';
import { AREA_HOME, ROUTES } from '../../lib/routes';
import { EditProfilePage } from './edit-profile';
import { OfficeHomePage } from './home';
import { ListingStatus } from './listing-status';
import { BACK_TO_REVIEW } from './profile-edit-form';

const hrefs = (html: string) => tags(html, 'a').map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);
const names = (html: string) => tags(html, 'input').map((tag) => /name="([^"]+)"/.exec(tag)?.[1]);

function status(listing: ListingState, patch: Partial<Distributor> = {}, isFounder = true): string {
  const distributor = distributorOf('d-norte', patch);
  return renderStatic(
    <ListingStatus distributor={distributor} listing={listing} isOwner isFounder={isFounder} />,
  );
}

function officeAs(role: 'owner' | 'dispatcher', listing: ListingState, patch = {}) {
  const working = workingAs([memberOf(role)], patch);
  return accountOf({ current: working.status === 'ready' ? { ...working, listing } : working });
}

function inOffice(page: React.ReactElement, account = officeAs('owner', 'listed'), path = '') {
  return renderStatic(page, {
    path: path || AREA_HOME.office,
    shell: <AppShell area="office" />,
    account,
  });
}

// PLAN 2.11: where the distributor stands with the review of the platform.
describe('listing status of the office', () => {
  it('tells a new distributor that it is in review and that customers do not see it yet', () => {
    const text = textOf(status('inReview', { listingApproved: false, acceptingOrders: false }));

    expect(text).toContain('En revisión');
    expect(text).toContain(
      'Estamos revisando tus datos. Mientras tanto puedes preparar tu catálogo; tus clientes todavía no te ven.',
    );
    expect(text).not.toContain('Copiar enlace');
  });

  it('shows the note of the platform and lets the founder correct the three data', () => {
    const html = status('changesRequested', {
      listingApproved: false,
      reviewNote: 'El RUC no coincide con la razón social.',
    });
    const text = textOf(html);

    expect(text).toContain('Cambios pedidos');
    expect(text).toContain('Nota de Hornilla');
    expect(text).toContain('El RUC no coincide con la razón social.');
    expect(text).toContain('Corregir mis datos');
    expect(hrefs(html)).toContain(ROUTES.officeProfile);
    // Closed until asked for: the private data is not read, nor shown, before that.
    expect(names(html)).toEqual([]);
  });

  it('tells a co-owner who corrects the data instead of offering a form that would fail', () => {
    const text = textOf(
      status('changesRequested', { listingApproved: false, reviewNote: 'Revisa el RUC.' }, false),
    );

    expect(text).not.toContain('Corregir mis datos');
    expect(text).toContain('los corrige quien registró la distribuidora');
  });

  it('gives a listed distributor its public link, to open it and to copy it', () => {
    const html = status('listed');

    expect(textOf(html)).toContain('Visible en el buscador');
    expect(hrefs(html)).toContain('/d/gas-demo-norte');
    expect(textOf(html)).toContain('/d/gas-demo-norte');
    expect(textOf(html)).toContain('Copiar enlace');
  });

  it('says that an approved distributor that cannot operate is not shown', () => {
    const text = textOf(status('notOperating', { status: 'suspended' }));

    expect(text).toContain('Sin operar');
    expect(text).toContain('no aparece en el buscador');
    expect(text).not.toContain('Copiar enlace');
  });

  it.each(['inReview', 'changesRequested', 'listed', 'notOperating'] as const)(
    'never calls the distributor verified or authorised (%s)',
    (listing) => {
      expect(textOf(status(listing, { reviewNote: 'Nota.' }))).not.toMatch(
        /verificad[ao]|autorizad[ao]/i,
      );
    },
  );
});

describe('office home with the listing status (PLAN 2.11)', () => {
  it('puts the status above the set-up list, with one h1 on the page', () => {
    const html = inOffice(<OfficeHomePage />, officeAs('owner', 'inReview'));
    const text = textOf(html);

    expect(count(html, /<h1\b/)).toBe(1);
    expect(text.indexOf('Tu ficha en Hornilla')).toBeLessThan(
      text.indexOf('Completa tu distribuidora'),
    );
    expect(text).toContain('Por ahora solo la ve tu personal');
    expect(hrefs(html)).toContain(ROUTES.officeProfile);
  });

  it('shows the status to the dispatcher too, without the ways to edit', () => {
    const html = inOffice(<OfficeHomePage />, officeAs('dispatcher', 'inReview'));

    expect(textOf(html)).toContain('En revisión');
    expect(hrefs(html)).not.toContain(ROUTES.officeProfile);
  });
});

describe('edit the public profile (PLAN 2.11)', () => {
  const html = inOffice(<EditProfilePage />, officeAs('owner', 'listed'), ROUTES.officeProfile);
  const text = textOf(html);

  it('shows every editable field with what is stored, under one h1', () => {
    const named = (name: string) =>
      tags(html, 'input').find((tag) => tag.includes(`name="${name}"`)) ?? '';

    expect(count(html, /<h1\b/)).toBe(1);
    expect(text).toContain('Edita tu ficha.');
    expect(names(html).filter(Boolean)).toEqual([
      'name',
      'contactPhone',
      'whatsapp',
      'addressLine',
      'opensAt',
      'closesAt',
      'brandColor',
    ]);
    expect(named('name')).toContain('value="Gas Demo Norte"');
    expect(named('contactPhone')).toContain('value="900000011"');
    expect(named('opensAt')).toContain('value="07:00"');
    expect(named('opensAt')).toContain('type="time"');
    expect(text).toContain('Radio de cobertura');
    expect(text).toContain('5 km');
  });

  it('offers the seven days as buttons, pressed for the days it attends', () => {
    const days = tags(html, 'button').filter((tag) => /aria-label="(Lunes|Domingo)"/.test(tag));

    expect(count(html, /aria-label="(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)"/)).toBe(
      7,
    );
    expect(days.find((tag) => tag.includes('Lunes'))).toContain('aria-pressed="true"');
    expect(days.find((tag) => tag.includes('Domingo'))).toContain('aria-pressed="false"');
  });

  it('previews the brand in light and in dark', () => {
    expect(count(html, /<figure class="light"/)).toBeGreaterThan(0);
    expect(count(html, /<figure class="dark"/)).toBeGreaterThan(0);
  });

  it('says nothing about a review before the name or a phone is touched', () => {
    expect(text).not.toContain(BACK_TO_REVIEW);
    expect(text).toContain('Guardar cambios');
    expect(BACK_TO_REVIEW).toContain('dejará de verse en el buscador');
    expect(BACK_TO_REVIEW).toContain('hasta que Hornilla la apruebe');
  });

  it('is for the owner: the dispatcher is told so and gets no form', () => {
    const dispatcher = inOffice(
      <EditProfilePage />,
      officeAs('dispatcher', 'listed'),
      ROUTES.officeProfile,
    );

    expect(textOf(dispatcher)).toContain('La ficha la edita quien es titular.');
    expect(names(dispatcher)).toEqual([]);
  });

  it('warns that nothing can be saved while the distributor is read-only', () => {
    const working = workingAs([memberOf('owner')], { status: 'suspended' });
    const readOnly = accountOf({
      current: working.status === 'ready' ? { ...working, isWritable: false } : working,
    });

    expect(textOf(inOffice(<EditProfilePage />, readOnly, ROUTES.officeProfile))).toContain(
      'no se pueden guardar cambios',
    );
  });

  it('belongs to the account that is signed in', () => {
    expect(distributorOf('d-norte').ownerUid).toBe(SESSION.uid);
  });
});
