import { type SortKey } from './common-d';

export const defaultSorter = (sortKey1: SortKey, sortKey2: SortKey): number =>
  sortKey1 < sortKey2 ? -1 : 1;
