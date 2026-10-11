import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '@/domain/auth/access';
import {
  AREA_HOME,
  destinationOf,
  destinationState,
  distributorPath,
  platformListingPath,
  registerPathFrom,
  ROUTES,
  safeReturnPath,
  signInPathFrom,
  transitionDirection,
} from './routes';

describe('routes', () => {
  it('has a different path for every screen', () => {
    const paths = Object.values(ROUTES);

    expect(new Set(paths).size).toBe(paths.length);
  });

  // PLAN 2.5
  it('builds the public path of a distributor from its slug', () => {
    expect(distributorPath('gas-demo-norte')).toBe('/d/gas-demo-norte');
    expect(distributorPath('a/b?c')).toBe('/d/a%2Fb%3Fc');
  });

  it('gives every area a home', () => {
    expect(Object.keys(AREA_HOME).sort()).toEqual([...APP_AREAS].sort());
  });
});

describe('safeReturnPath', () => {
  it.each(['/central', '/cuenta', '/d/gas-demo?peso=10', '/pedidos#ultimo', '/'])(
    'keeps the internal path %j',
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    '',
    'central',
    '//evil.example.com',
    '/\\evil.example.com',
    '/ruta\\evil',
    'https://evil.example.com',
    'javascript:alert(1)',
    ' /central',
    '/central\n/otra',
    '/ingresar',
    '/ingresar?desde=/central',
    '/registro',
  ])('refuses %j', (path) => {
    expect(safeReturnPath(path)).toBeNull();
  });
});

describe('signInPathFrom', () => {
  it('remembers where the visitor was going', () => {
    expect(signInPathFrom('/central')).toBe('/ingresar?desde=%2Fcentral');
    expect(signInPathFrom('/pedidos?estado=hoy')).toBe('/ingresar?desde=%2Fpedidos%3Festado%3Dhoy');
  });

  it.each(['/', '//evil.example.com', '/ingresar'])('adds nothing for %j', (from) => {
    expect(signInPathFrom(from)).toBe('/ingresar');
  });
});

describe('transitionDirection', () => {
  it.each([
    ['/pedidos', '/pedidos/1047', 'forward'],
    ['/pedidos/1047', '/pedidos', 'back'],
    ['/ingresar', '/restablecer', 'forward'],
    ['/restablecer', '/ingresar', 'back'],
    ['/inicio', '/pedidos', 'fade'],
    ['/inicio', '/cuenta', 'fade'],
    ['/', '/d/gas-demo-norte', 'forward'],
    ['/d/gas-demo-norte', '/', 'back'],
    ['/inicio', '/d/gas-demo-norte', 'forward'],
    ['/cuenta', '/d/gas-demo-norte', 'fade'],
    ['/', '/ingresar', 'fade'],
    ['/ingresar', '/', 'fade'],
    ['/pedidos', '/pedidos-antiguos', 'fade'],
    ['/central', '/central', 'fade'],
  ])('%s → %s is %s', (from, to, expected) => {
    expect(transitionDirection(from, to)).toBe(expected);
  });
});

// PLAN 2.11: where a visitor was going survives the registration and both pending steps.
describe('registerPathFrom', () => {
  it('keeps the destination of whoever was asked to sign in on the way somewhere', () => {
    expect(registerPathFrom('/distribuidora/nueva')).toBe(
      '/registro?desde=%2Fdistribuidora%2Fnueva',
    );
  });

  it.each([null, undefined, '', '/', '//evil.example', 'https://evil.example', '/ingresar'])(
    'is the plain registration for %j',
    (from) => {
      expect(registerPathFrom(from)).toBe('/registro');
    },
  );
});

describe('destination carried through the pending steps', () => {
  it('travels as navigation state and is read back', () => {
    const state = destinationState('/distribuidora/nueva');

    expect(state).toEqual({ after: '/distribuidora/nueva' });
    expect(destinationOf({ justRegistered: true, ...state })).toBe('/distribuidora/nueva');
  });

  it.each(['/verificar-correo', '/aceptar-terminos', '/app', '/', '/registro', null, undefined])(
    'has nothing to carry for %j',
    (from) => {
      expect(destinationState(from)).toBeUndefined();
    },
  );

  it.each([
    null,
    undefined,
    'texto',
    {},
    { after: 7 },
    { after: '//evil.example/x' },
    { after: 'https://evil.example' },
    { after: '/\\evil.example' },
    { after: '/aceptar-terminos' },
  ])('distrusts a state it did not write: %j', (state) => {
    expect(destinationOf(state)).toBeNull();
  });
});

describe('paths of the screens of PLAN 2.11', () => {
  it('builds the review of a listing and treats it as a detail of the platform home', () => {
    expect(platformListingPath('abc123')).toBe('/plataforma/altas/abc123');
    expect(transitionDirection(ROUTES.platformHome, platformListingPath('abc123'))).toBe('forward');
    expect(transitionDirection(ROUTES.officeProfile, ROUTES.officeHome)).toBe('back');
  });
});
