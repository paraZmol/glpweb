import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '@/domain/auth/access';
import {
  AREA_HOME,
  distributorPath,
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
