import { describe, expect, it } from 'vitest';
import { formatCoordinates, formatDistanceKm, parseCoordinates } from './coordinates';

// PLAN 2.6: the manual alternative to "Usar mi ubicación".
describe('parseCoordinates', () => {
  it.each([
    ['-12.0464, -77.0428', { lat: -12.0464, lng: -77.0428 }],
    ['-12.0464,-77.0428', { lat: -12.0464, lng: -77.0428 }],
    ['  -12.05   -77.04 ', { lat: -12.05, lng: -77.04 }],
    ['-12.05; -77.04', { lat: -12.05, lng: -77.04 }],
    ['https://maps.example.com/@-12.0464,-77.0428,17z', { lat: -12.0464, lng: -77.0428 }],
    ['Mi casa: -9.5278, -77.5278 (frente al parque)', { lat: -9.5278, lng: -77.5278 }],
    ['40.4168, -3.7038', { lat: 40.4168, lng: -3.7038 }],
  ])('reads %j', (text, expected) => {
    expect(parseCoordinates(text)).toEqual(expected);
  });

  it.each([
    '',
    'Jr. Los Cedros 245',
    'Av. Ejemplo 12, 77',
    '-12, -77',
    '-12.05',
    '-95.5, -77.04',
    '-12.05, -181.5',
    'lat -12.05 lng',
  ])('finds no point in %j', (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});

describe('formatCoordinates', () => {
  it('shows four decimals, latitude first', () => {
    expect(formatCoordinates({ lat: -12.05, lng: -77.04281 })).toBe('-12.0500, -77.0428');
  });
});

describe('formatDistanceKm', () => {
  it.each([
    [0, '0,0 km'],
    [0.04, '0,0 km'],
    [0.84, '0,8 km'],
    [1.112, '1,1 km'],
    [2.26, '2,3 km'],
    [9.94, '9,9 km'],
    [9.96, '10 km'],
    [12.4, '12 km'],
    [-3, '0,0 km'],
  ])('shows %d km as %s', (distanceKm, expected) => {
    expect(formatDistanceKm(distanceKm)).toBe(expected);
  });
});
