import type { TRPCError } from '@datalking/pivot-trpc';
import { createApi } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: (trpcResult: Promise<unknown>) =>
    trpcResult
      .then((data) => ({ data }))
      .catch((error: TRPCError) => ({ error })),
  endpoints: () => ({}),
  tagTypes: ['Table', 'Record', 'TreeRecord'],
});
