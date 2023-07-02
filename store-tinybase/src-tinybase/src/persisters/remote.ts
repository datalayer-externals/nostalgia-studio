import { type Callback, type Json } from '../common-d';
import { ifNotUndefined, isUndefined } from '../common/other';
import {
  type createRemotePersister as createRemotePersisterDecl,
  type Persister,
} from '../persisters-d';
import { type Store } from '../store-d';
import { createCustomPersister } from './common';

const getETag = (response: Response) => response.headers.get('ETag');

export const createRemotePersister: typeof createRemotePersisterDecl = (
  store: Store,
  loadUrl: string,
  saveUrl: string,
  autoLoadIntervalSeconds: number,
): Persister => {
  let interval: NodeJS.Timeout | undefined;
  let lastEtag: string | null;

  const getPersisted = async (): Promise<string | null | undefined> => {
    const response = await fetch(loadUrl);
    lastEtag = getETag(response);
    return response.text();
  };

  const setPersisted = async (json: Json): Promise<any> =>
    await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });

  const startListeningToPersisted = (didChange: Callback): void => {
    interval = setInterval(async () => {
      const response = await fetch(loadUrl, { method: 'HEAD' });
      const currentEtag = getETag(response);
      if (
        !isUndefined(lastEtag) &&
        !isUndefined(currentEtag) &&
        currentEtag != lastEtag
      ) {
        lastEtag = currentEtag;
        didChange();
      }
    }, autoLoadIntervalSeconds * 1000);
  };

  const stopListeningToPersisted = (): void => {
    ifNotUndefined(interval, clearInterval);
    interval = undefined;
  };

  return createCustomPersister(
    store,
    getPersisted,
    setPersisted,
    startListeningToPersisted,
    stopListeningToPersisted,
  );
};
