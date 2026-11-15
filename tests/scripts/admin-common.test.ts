// The paging the account scripts use to read every stock adjustment of an account (PLAN 3.4),
// without one unbounded read.
import { describe, expect, it } from 'vitest';
import { allDocuments, type PagedQuery } from '../../scripts/admin-common.mjs';

/** A query over `items` in their order, which records the size of every page it was asked for. */
function fakeQuery(items: number[], asked: number[], after = -1): PagedQuery<number> {
  return {
    limit: (count) => ({
      get: async () => {
        asked.push(count);
        const docs = items.filter((item) => item > after).slice(0, count);
        return { docs, size: docs.length };
      },
    }),
    startAfter: (last) => fakeQuery(items, asked, last),
  };
}

describe('allDocuments', () => {
  it('reads past the first page until a page comes back short', async () => {
    const asked: number[] = [];

    const found = await allDocuments(fakeQuery([1, 2, 3, 4, 5], asked), 2);

    expect(found).toEqual([1, 2, 3, 4, 5]);
    expect(asked).toEqual([2, 2, 2]);
  });

  it('asks once more when the last page was exactly full, and stops on the empty one', async () => {
    const asked: number[] = [];

    expect(await allDocuments(fakeQuery([1, 2, 3, 4], asked), 2)).toEqual([1, 2, 3, 4]);
    expect(asked).toEqual([2, 2, 2]);
  });

  it('returns nothing when nothing matches', async () => {
    expect(await allDocuments(fakeQuery([], []), 2)).toEqual([]);
  });
});
