import { describe, expect, it } from 'vitest';
import { cylinderSilhouetteFor } from './cylinder-shape';
import { monogramOf } from './monogram';

describe('cylinderSilhouetteFor', () => {
  it.each([
    [10, 86],
    [15, 116],
    [45, 176],
  ])('has its own silhouette for %i kg', (weightKg, bodyHeight) => {
    expect(cylinderSilhouetteFor(weightKg).bodyHeight).toBe(bodyHeight);
  });

  it.each([
    [5, 86],
    [0, 86],
    [-3, 86],
    [11, 86],
    [14.9, 86],
    [30, 116],
    [100, 176],
  ])('uses the standard silhouette just below %d kg', (weightKg, bodyHeight) => {
    expect(cylinderSilhouetteFor(weightKg).bodyHeight).toBe(bodyHeight);
  });
});

describe('monogramOf', () => {
  it.each([
    ['Gas Demo Norte', 'GD'],
    ['  gas   demo ', 'GD'],
    ['Ñandú Gas', 'ÑG'],
    ['Élite', 'ÉL'],
    ['x', 'X'],
    ['24 Horas Gas', '2H'],
    ['"El Sol" & Cía.', 'ES'],
    ['🔥 Fuego', 'FU'],
    ['', 'H'],
    ['***', 'H'],
  ])('turns %j into %j', (name, expected) => {
    expect(monogramOf(name)).toBe(expected);
  });
});
