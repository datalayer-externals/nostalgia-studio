import { arrayEvery, arrayLength, arrayMap } from './common/array';
import { getCellType } from './common/cell';
import { collForEach } from './common/coll';
import { getCreateFunction } from './common/definable';
import { IdMap, mapEnsure, mapNew, mapSet } from './common/map';
import { objFreeze, objIsEmpty } from './common/obj';
import { jsonParse } from './common/other';
import { DEFAULT, TYPE } from './common/strings';
import type { Cell, Schema, Store } from './store-d';
import { createTools as createToolsDecl, StoreStats, Tools } from './tools-d';
import { getStoreApi as getStoreApiImpl } from './tools/api';
import { formatJsDoc, length } from './tools/code';

type CellMeta = [string, IdMap<number>, [number, Cell?], number];

const prettierConfig = {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: false,
  jsdocSingleLineComment: false,
} as any;

export const createTools: typeof createToolsDecl = getCreateFunction(
  (store: Store): Tools => {
    const getStoreStats = (detail?: boolean): StoreStats => {
      let totalTables = 0;
      let totalRows = 0;
      let totalCells = 0;
      const tables: any = {};

      store.forEachTable((tableId, forEachRow) => {
        totalTables++;
        let tableRows = 0;
        let tableCells = 0;
        const rows: any = {};

        forEachRow((rowId, forEachCell) => {
          tableRows++;
          let rowCells = 0;

          forEachCell(() => rowCells++);

          tableCells += rowCells;
          if (detail) {
            rows[rowId] = { rowCells };
          }
        });

        totalRows += tableRows;
        totalCells += tableCells;
        if (detail) {
          tables[tableId] = { tableRows, tableCells, rows };
        }
      });

      return {
        totalTables,
        totalRows,
        totalCells,
        jsonLength: length(store.getJson()),
        ...(detail ? { detail: { tables } } : {}),
      };
    };

    const getStoreSchema = (): Schema => {
      const schema: Schema = jsonParse(store.getSchemaJson());
      if (
        !objIsEmpty(schema) ||
        arrayEvery(store.getTableIds(), (tableId): any => {
          const rowIds = store.getRowIds(tableId);
          const cellsMeta: IdMap<CellMeta> = mapNew();
          if (
            arrayEvery(rowIds, (rowId) =>
              arrayEvery(store.getCellIds(tableId, rowId), (cellId) => {
                const value = store.getCell(tableId, rowId, cellId) as Cell;
                const cellMeta: CellMeta = mapEnsure(cellsMeta, cellId, () => [
                  getCellType(value) as string,
                  mapNew(),
                  [0],
                  0,
                ]);
                const [type, values, [maxCount]] = cellMeta;
                const count = (mapEnsure(values, value, () => 0) as number) + 1;
                if (count > maxCount) {
                  cellMeta[2] = [count, value];
                }
                mapSet(values, value, count);
                cellMeta[3]++;
                return type == getCellType(value);
              }),
            )
          ) {
            schema[tableId] = {};
            collForEach(cellsMeta, ([type, , [, maxValue], count], cellId) => {
              schema[tableId][cellId] = {
                [TYPE]: type as any,
                ...(count == arrayLength(rowIds)
                  ? { [DEFAULT]: maxValue }
                  : {}),
              };
            });
            return 1;
          }
        })
      ) {
        return schema;
      }
      return {};
    };

    const getStoreApi = (module: string): [string, string] =>
      getStoreApiImpl(getStoreSchema(), module);

    const getPrettyStoreApi = async (
      module: string,
    ): Promise<[string, string]> => {
      let format: (str: string, _config: any) => string;
      try {
        format = (await import('prettier')).format;
      } catch {
        format = (str) => str;
      }
      return arrayMap(getStoreApi(module), (file) =>
        formatJsDoc(format(file, prettierConfig)),
      ) as [string, string];
    };

    const tools: Tools = {
      getStoreStats,
      getStoreSchema,
      getStoreApi,
      getPrettyStoreApi,
    };

    return objFreeze(tools);
  },
);
