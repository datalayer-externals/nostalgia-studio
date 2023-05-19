import { equal } from 'uvu/assert';
import { test } from 'uvu';

import { persistentAtom, persistentMap } from '../index';

test('works without localStorage for map', () => {
  let map = persistentMap<{ one?: string; two?: string }>('a:', {
    one: '1',
  });
  map.listen(() => {});
  map.setKey('two', '2');
  equal(map.get(), { one: '1', two: '2' });
});

test('works without localStorage for atom', () => {
  let store = persistentAtom<string>('a', '1');
  store.listen(() => {});
  store.set('2');
  equal(store.get(), '2');
});

test.run();
