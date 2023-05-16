import type { IQueryTable } from '@datalking/pivot-core';
import type {
  ICreateTableInput,
  ICreateTableOutput,
  IGetTableOutput,
  IGetTableQuery,
  IGetTablesOutput,
  IGetTablesQuery,
} from '@datalking/pivot-cqrs';
import type { EntityState } from '@reduxjs/toolkit';
import { createEntityAdapter } from '@reduxjs/toolkit';

import { trpc } from '../trpc';
import { api } from './api';

const tableAdapter = createEntityAdapter<IQueryTable>();
const initialState = tableAdapter.getInitialState();

type QueryTableEntityState = EntityState<IQueryTable>;

const providesTags = (result: QueryTableEntityState | undefined) => [
  'Table' as const,
  ...(result?.ids?.map((id) => ({ type: 'Table' as const, id })) ?? []),
];

export const tableApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTables: builder.query<QueryTableEntityState, IGetTablesQuery>({
      query: trpc.table.list.query,
      providesTags,
      transformResponse: (result: IGetTablesOutput) =>
        tableAdapter.setAll(initialState, result),
    }),
    getTable: builder.query<IGetTableOutput, IGetTableQuery>({
      query: trpc.table.get.query,
      providesTags: (_, __, args) => [{ type: 'Table', id: args.id }],
    }),
    createTable: builder.mutation<ICreateTableOutput, ICreateTableInput>({
      query: trpc.table.create.mutate,
      invalidatesTags: ['Table'],
    }),
    updateTable: builder.mutation({
      query: trpc.table.update.mutate,
      invalidatesTags: ['Table'],
    }),
    deleteTable: builder.mutation({
      query: trpc.table.delete.mutate,
      invalidatesTags: ['Table'],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetTablesQuery,
  useGetTableQuery,
  useLazyGetTableQuery,
  useCreateTableMutation,
  useUpdateTableMutation,
  useDeleteTableMutation,
} = tableApi;
