import { describe, expect, it } from 'vitest';
import { canEditCatalog } from './permissions';

describe('canEditCatalog', () => {
  it.each([
    ['owner', true],
    ['dispatcher', true],
    ['driver', false],
  ] as const)('%s → %s', (role, expected) => {
    expect(canEditCatalog(role)).toBe(expected);
  });
});
