/** One page of a query, as the Admin SDK hands it over; only what the paging reads. */
interface Page<Doc> {
  docs: Doc[];
  size: number;
}

/** A Firestore query of the Admin SDK, seen only through what `allDocuments` calls. */
export interface PagedQuery<Doc> {
  limit(count: number): { get(): Promise<Page<Doc>> };
  startAfter(last: Doc): PagedQuery<Doc>;
}

export function allDocuments<Doc>(query: PagedQuery<Doc>, pageSize?: number): Promise<Doc[]>;
