import type { Option } from 'oxide.ts';
import type { ITableSpec } from './specifications/interface.js';
import type { IQueryTable } from './table.js';

export interface ITableQueryModel {
  findOne(spec: ITableSpec): Promise<Option<IQueryTable>>;
  findOneById(id: string): Promise<Option<IQueryTable>>;
  find(): Promise<IQueryTable[]>;
}
