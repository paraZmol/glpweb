import { describe, expect, it } from 'vitest';
import { haversineKm, isValidGeoPoint, isWithinCoverage, sortByDistance } from './distance';

// Generic city-centre coordinates, not anyone's address.
const CITY_CENTRE = { lat: -12.0464, lng: -77.0428 };
const SOUTHERN_CITY = { lat: -16.409, lng: -71.5375 };

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(CITY_CENTRE, CITY_CENTRE)).toBe(0);
  });

  it('measures one degree of latitude as about 111 km', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.195, 2);
  });

  it('measures the distance between two cities', () => {
    const distanceKm = haversineKm(CITY_CENTRE, SOUTHERN_CITY);
    expect(distanceKm).toBeGreaterThan(760);
    expect(distanceKm).toBeLessThan(770);
  });

  it('is symmetric', () => {
    expect(haversineKm(CITY_CENTRE, SOUTHERN_CITY)).toBeCloseTo(
      haversineKm(SOUTHERN_CITY, CITY_CENTRE),
      9,
    );
  });

  it('handles antipodes without returning NaN', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015.1, 0);
  });
});

describe('isValidGeoPoint', () => {
  it.each([
    [{ lat: 0, lng: 0 }, true],
    [{ lat: -90, lng: 180 }, true],
    [{ lat: 90.0001, lng: 0 }, false],
    [{ lat: 0, lng: -180.5 }, false],
    [{ lat: Number.NaN, lng: 0 }, false],
    [{ lat: 0, lng: Number.POSITIVE_INFINITY }, false],
  ])('%o → %s', (point, expected) => {
    expect(isValidGeoPoint(point)).toBe(expected);
  });
});

describe('isWithinCoverage', () => {
  const oneKmNorth = { lat: CITY_CENTRE.lat + 0.009, lng: CITY_CENTRE.lng };

  it('accepts a point inside the radius', () => {
    expect(isWithinCoverage(CITY_CENTRE, oneKmNorth, 5)).toBe(true);
  });

  it('accepts the plant itself', () => {
    expect(isWithinCoverage(CITY_CENTRE, CITY_CENTRE, 1)).toBe(true);
  });

  it('rejects a point outside the radius', () => {
    expect(isWithinCoverage(CITY_CENTRE, oneKmNorth, 0.5)).toBe(false);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('rejects radius %s', (radiusKm) => {
    expect(isWithinCoverage(CITY_CENTRE, CITY_CENTRE, radiusKm)).toBe(false);
  });

  it('rejects invalid coordinates', () => {
    expect(isWithinCoverage(CITY_CENTRE, { lat: 91, lng: 0 }, 50_000)).toBe(false);
    expect(isWithinCoverage({ lat: Number.NaN, lng: 0 }, CITY_CENTRE, 50_000)).toBe(false);
  });
});

describe('sortByDistance', () => {
  const places = [
    { name: 'far', plant: SOUTHERN_CITY },
    { name: 'here', plant: CITY_CENTRE },
    { name: 'near', plant: { lat: CITY_CENTRE.lat + 0.02, lng: CITY_CENTRE.lng } },
  ];

  it('orders nearest first and reports each distance', () => {
    const sorted = sortByDistance(places, CITY_CENTRE, (place) => place.plant);
    expect(sorted.map((entry) => entry.item.name)).toEqual(['here', 'near', 'far']);
    expect(sorted[0]?.distanceKm).toBe(0);
    expect(sorted[1]?.distanceKm).toBeCloseTo(2.22, 1);
  });

  it('does not mutate the input', () => {
    sortByDistance(places, CITY_CENTRE, (place) => place.plant);
    expect(places.map((place) => place.name)).toEqual(['far', 'here', 'near']);
  });

  it('returns an empty list for no items', () => {
    expect(
      sortByDistance([], CITY_CENTRE, (place: { plant: typeof CITY_CENTRE }) => place.plant),
    ).toEqual([]);
  });
});
