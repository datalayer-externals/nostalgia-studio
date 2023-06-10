import { test } from 'uvu';
import { equal, is, not, ok, throws, type } from 'uvu/assert';

import {
  type Action,
  Log,
  type LogPage,
  MemoryStore,
  type Meta,
} from '../index';

function createLog(): Log<Meta, MemoryStore> {
  return new Log({
    nodeId: 'test',
    store: new MemoryStore(),
  });
}

function checkActions(log: Log<Meta, MemoryStore>, expected: Action[]): void {
  let actions = log.store.entries.map((entry) => entry[0]);
  equal(actions, expected);
}

function checkEntries(
  log: Log<Meta, MemoryStore>,
  expected: [Action, Partial<Meta>][],
): void {
  let entries = log.store.entries.map((entry) => [entry[0], entry[1]]);
  equal(entries, expected);
}

async function logWith(
  entries: [Action, Partial<Meta>][],
): Promise<Log<Meta, MemoryStore>> {
  let log = createLog();
  await Promise.all(entries.map((entry) => log.add(entry[0], entry[1])));
  return log;
}

async function getError(cb: () => Promise<any>): Promise<string> {
  try {
    await cb();
  } catch (e) {
    if (e instanceof Error) return e.message;
  }
  throw new Error('Error was not thrown');
}

let originNow = Date.now;
test.after.each(() => {
  Date.now = originNow;
});

test('requires node ID', () => {
  throws(() => {
    // @ts-expect-error
    new Log();
  }, /node ID/);
});

test('requires store', () => {
  throws(() => {
    // @ts-expect-error
    new Log({ nodeId: 'test' });
  }, /store/);
});

test('checks node ID', () => {
  throws(() => {
    new Log({ nodeId: 'a b', store: new MemoryStore() });
  }, /Space/);
});

test('requires type for action', async () => {
  let log = createLog();
  // @ts-expect-error
  ok((await getError(() => log.add({ a: 1 }))).includes('"type" in action'));
});

test('sends new entries to listeners', async () => {
  let log = createLog();
  let actions1: Action[] = [];
  let actions2: Action[] = [];

  await log.add({ type: 'A' });
  log.on('add', (action, meta) => {
    type(meta, 'object');
    actions1.push(action);
  });

  log.on('add', (action) => {
    actions2.push(action);
  });

  equal(actions1, []);
  equal(actions2, []);

  await log.add({ type: 'B' });
  await log.add({ type: 'C' });
  equal(actions1, [{ type: 'B' }, { type: 'C' }]);
  equal(actions2, actions1);
});

test('unsubscribes listeners', async () => {
  let log = createLog();

  let actions: Action[] = [];
  let unsubscribe = log.on('add', (action) => {
    actions.push(action);
  });

  await log.add({ type: 'A' });
  unsubscribe();
  await log.add({ type: 'B' });
  equal(actions, [{ type: 'A' }]);
});

test('ignore entry with existed ID', async () => {
  let log = createLog();

  let added: Action[] = [];
  log.on('add', (action) => {
    added.push(action);
  });

  let meta = { id: '0 n 0', reasons: ['test'] };
  let result1 = await log.add({ type: 'A' }, meta);
  type(result1, 'object');
  let result2 = await log.add({ type: 'B' }, meta);
  is(result2, false);
  checkActions(log, [{ type: 'A' }]);
  equal(added, [{ type: 'A' }]);
});

test('iterates through added entries', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n 0', reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n 0', reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n 0', reasons: ['test'] }],
  ]);
  let entries: [Action, Meta][] = [];
  await log.each((action, meta) => {
    entries.push([action, meta]);
  });
  equal(entries, [
    [{ type: 'A' }, { id: '3 n 0', time: 3, added: 1, reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n 0', time: 2, added: 2, reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n 0', time: 1, added: 3, reasons: ['test'] }],
  ]);
});

test('iterates by added order', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n 0', reasons: ['test'] }],
    [{ type: 'B' }, { id: '2 n 0', reasons: ['test'] }],
    [{ type: 'C' }, { id: '1 n 0', reasons: ['test'] }],
  ]);
  let actions: Action[] = [];
  await log.each({ order: 'added' }, (action) => {
    actions.push(action);
  });
  equal(actions, [{ type: 'C' }, { type: 'B' }, { type: 'A' }]);
});

test('iterates by index', async () => {
  let log = await logWith([
    [{ type: 'A' }, { id: '3 n 0', reasons: ['test'], indexes: ['a'] }],
    [{ type: 'B' }, { id: '2 n 0', reasons: ['test'], indexes: ['a', 'b'] }],
    [{ type: 'C' }, { id: '1 n 0', reasons: ['test'], indexes: ['b'] }],
  ]);
  let actions: Action[] = [];
  await log.each({ index: 'b' }, (action) => {
    actions.push(action);
  });
  equal(actions, [{ type: 'C' }, { type: 'B' }]);
});

test('disables iteration on false', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['test'] }],
    [{ type: 'B' }, { reasons: ['test'] }],
  ]);
  let actions: Action[] = [];
  await log.each((action) => {
    actions.push(action);
    return false;
  });
  equal(actions, [{ type: 'B' }]);
});

test('supports multi-pages stores', async () => {
  let store = new MemoryStore();
  let meta: Meta = { id: '1 0 0', added: 0, time: 0, reasons: [] };
  let get: (opts?: object) => Promise<LogPage> = async () => {
    return {
      entries: [[{ type: 'a' }, meta]],
      async next(): Promise<LogPage> {
        return { entries: [[{ type: 'b' }, meta]] };
      },
    };
  };
  store.get = get;
  let log = new Log({ nodeId: 'test', store });

  let actions: Action[] = [];
  await log.each((action) => {
    actions.push(action);
  });
  equal(actions, [{ type: 'a' }, { type: 'b' }]);
});

test('copies time from ID', async () => {
  let log = await logWith([
    [{ type: 'TIMED' }, { id: '100 n 0', reasons: ['test'] }],
  ]);
  checkEntries(log, [
    [
      { type: 'TIMED' },
      { id: '100 n 0', time: 100, added: 1, reasons: ['test'] },
    ],
  ]);
});

test('keeps existed ID, time and reasons', async () => {
  let log = await logWith([
    [{ type: 'TIMED' }, { id: '100 n 0', time: 1, reasons: ['a'] }],
  ]);
  checkEntries(log, [
    [{ type: 'TIMED' }, { id: '100 n 0', time: 1, added: 1, reasons: ['a'] }],
  ]);
});

test('sets default ID and time and empty reasons for new entries', async () => {
  let log = createLog();
  let called = 0;
  log.on('add', (action, meta) => {
    called += 1;
    type(meta.added, 'undefined');
    equal(meta.reasons, []);
    type(meta.time, 'number');
    equal(meta.id, `${meta.time} test 0`);
  });
  await log.add({ type: 'A' });
  equal(called, 1);
});

test('generates unique ID', () => {
  let log = createLog();
  let used = [];
  for (let i = 0; i < 100; i++) {
    let id = log.generateId();
    not.ok(used.includes(id));
    used.push(id);
  }
});

test('always generates biggest ID', () => {
  let log = createLog();
  let times = [10, 9];

  Date.now = () => times.shift() ?? 0;

  equal(log.generateId(), '10 test 0');
  equal(log.generateId(), '10 test 1');
});

test('changes meta', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['t'], id: '1 node 0' }],
    [{ type: 'B' }, { reasons: ['t'], id: '2 node 0', a: 1, indexes: ['a'] }],
  ]);
  let result = await log.changeMeta('2 node 0', { a: 2, b: 2 });
  is(result, true);
  checkEntries(log, [
    [{ type: 'A' }, { id: '1 node 0', time: 1, added: 1, reasons: ['t'] }],
    [
      { type: 'B' },
      {
        id: '2 node 0',
        time: 2,
        added: 2,
        reasons: ['t'],
        a: 2,
        b: 2,
        indexes: ['a'],
      },
    ],
  ]);
});

test('does not allow to change ID, added or indexes', async () => {
  let log = createLog();
  for (let key of ['id', 'added', 'time', 'subprotocol', 'indexes']) {
    ok(
      (await getError(() => log.changeMeta('1 n 0', { [key]: true }))).includes(
        `"${key}" is read-only`,
      ),
    );
  }
});

test('removes action on setting entry reasons', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['test'], id: '1 n 0' }],
    [{ type: 'B' }, { reasons: ['test'], id: '2 n 0' }],
  ]);
  let cleaned: [Action, Meta][] = [];
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta]);
  });

  let result1 = await log.changeMeta('2 n 0', { reasons: [], a: 1 });
  is(result1, true);
  equal(cleaned, [
    [{ type: 'B' }, { id: '2 n 0', time: 2, added: 2, reasons: [], a: 1 }],
  ]);
  checkEntries(log, [
    [{ type: 'A' }, { id: '1 n 0', time: 1, added: 1, reasons: ['test'] }],
  ]);
  let result2 = await log.changeMeta('3 n 0', { reasons: [] });
  is(result2, false);
});

test('returns action by ID', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['test'], id: '1 n 0' }],
  ]);

  let result1 = await log.byId('1 n 0');
  if (result1[0] === null) throw new Error('Action was no found');
  equal(result1[0], { type: 'A' });
  equal(result1[1].reasons, ['test']);

  let result2 = await log.byId('2 n 0');
  is(result2[0], null);
  is(result2[1], null);
});

test('cleans log by reason', async () => {
  let log = await logWith([
    [{ type: 'A' }, { reasons: ['a'] }],
    [{ type: 'AB' }, { reasons: ['a', 'b'] }],
    [{ type: 'B' }, { reasons: ['b'] }],
  ]);
  let cleaned: [Action, Meta['added'], Meta['reasons']][] = [];
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added, meta.reasons]);
  });
  await log.removeReason('a');
  checkActions(log, [{ type: 'AB' }, { type: 'B' }]);
  equal(log.store.entries[1][1].reasons, ['b']);
  equal(cleaned, [[{ type: 'A' }, 1, []]]);
});

test('removes reason with minimum and maximum added', async () => {
  let log = await logWith([
    [{ type: '1' }, { reasons: ['a'] }],
    [{ type: '2' }, { reasons: ['a'] }],
    [{ type: '3' }, { reasons: ['a'] }],
  ]);
  await log.removeReason('a', { maxAdded: 2, minAdded: 2 });
  checkActions(log, [{ type: '1' }, { type: '3' }]);
});

test('does not put actions without reasons to log', async () => {
  let log = createLog();

  let added: [Action, Meta['added']][] = [];
  log.on('add', (action, meta) => {
    type(meta.id, 'string');
    added.push([action, meta.added]);
  });
  let cleaned: [Action, Meta['added']][] = [];
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added]);
  });

  let meta = await log.add({ type: 'A' });
  if (meta === false) throw new Error('Action was no added');
  equal(meta.reasons, []);
  equal(added, [[{ type: 'A' }, undefined]]);
  equal(cleaned, [[{ type: 'A' }, undefined]]);
  checkActions(log, []);
  await log.add({ type: 'B' }, { reasons: ['test'] });
  equal(added, [
    [{ type: 'A' }, undefined],
    [{ type: 'B' }, 1],
  ]);
  equal(cleaned, [[{ type: 'A' }, undefined]]);
  checkActions(log, [{ type: 'B' }]);
});

test('checks ID for actions without reasons', async () => {
  let log = createLog();

  let added: [Action, Meta['added']][] = [];
  log.on('add', (action, meta) => {
    added.push([action, meta.added]);
  });
  let cleaned: [Action, Meta['added']][] = [];
  log.on('clean', (action, meta) => {
    cleaned.push([action, meta.added]);
  });

  await log.add({ type: 'A' }, { id: '1 n 0', reasons: ['t'] });
  let meta1 = await log.add({ type: 'B' }, { id: '1 n 0' });
  is(meta1, false);
  equal(added, [[{ type: 'A' }, 1]]);
  equal(cleaned, []);
  let meta2 = await log.add({ type: 'C' }, { id: '2 n 0' });
  type(meta2, 'object');
  equal(added, [
    [{ type: 'A' }, 1],
    [{ type: 'C' }, undefined],
  ]);
  equal(cleaned, [[{ type: 'C' }, undefined]]);
});

test('fires preadd event', async () => {
  let log = createLog();

  let add: string[] = [];
  log.on('add', (action) => {
    add.push(action.type);
  });

  let preadd: string[] = [];
  log.on('preadd', (action, meta) => {
    type(meta.added, 'undefined');
    if (action.type === 'A') meta.reasons.push('test');
    preadd.push(action.type);
  });

  await log.add({ type: 'A' }, { id: '1 n 0' });
  checkEntries(log, [
    [{ type: 'A' }, { id: '1 n 0', time: 1, added: 1, reasons: ['test'] }],
  ]);
  equal(preadd, ['A']);
  equal(add, ['A']);
  await log.add({ type: 'B' }, { id: '1 n 0' });
  equal(preadd, ['A', 'B']);
  equal(add, ['A']);
});

test('removes reasons when keepLast option is used', async () => {
  let log = await logWith([
    [{ type: '1' }, { keepLast: 'a' }],
    [{ type: '2' }, { keepLast: 'a' }],
    [{ type: '3' }, { keepLast: 'a' }],
  ]);
  checkActions(log, [{ type: '3' }]);
});

test('allows to set keepLast in preadd', async () => {
  let log = createLog();
  log.on('preadd', (action, meta) => {
    meta.keepLast = 'a';
  });
  await Promise.all([
    log.add({ type: '1' }),
    log.add({ type: '2' }),
    log.add({ type: '3' }),
  ]);
  checkActions(log, [{ type: '3' }]);
});

test('ensures `reasons` to be array of string values', async () => {
  let log = createLog();

  let meta1 = await log.add({ type: '1' });
  if (meta1 === false) throw new Error('Action was no found');
  equal(meta1.reasons, []);

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { reasons: 1 })),
    'Expected "reasons" to be an array of strings',
  );

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { reasons: [false, 1] })),
    'Expected "reasons" to be an array of strings',
  );
});

test('ensures `indexes` to be array of string values', async () => {
  let log = createLog();

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { indexes: 'a' })),
    'Expected "indexes" to be an array of strings',
  );

  equal(
    // @ts-expect-error
    await getError(() => log.add({ type: '3' }, { indexes: [false, 1] })),
    'Expected "indexes" to be an array of strings',
  );
});

test('has type listeners', async () => {
  let events: string[] = [];
  let log = createLog();

  let unsibscribeA = log.type('A', (action, meta) => {
    type(meta.id, 'string');
    events.push(`A: ${action.type}`);
  });

  log.type(
    'B',
    (action, meta) => {
      type(meta.id, 'string');
      events.push(`B add: ${action.type}`);
    },
    { event: 'add' },
  );

  log.type(
    'C',
    (action, meta) => {
      type(meta.id, 'string');
      events.push(`C preadd: ${action.type}`);
    },
    { event: 'preadd' },
  );

  log.type(
    'A',
    (action, meta) => {
      type(meta.id, 'string');
      events.push(`A clean: ${action.type}`);
    },
    { event: 'clean' },
  );

  log.on('add', (action) => {
    events.push(`add: ${action.type}`);
  });

  await log.add({ type: 'A' });
  await log.add({ type: 'A' }, { reasons: ['test'] });
  await log.add({ type: 'A' }, { id: '0 test 0', reasons: ['test', 'test2'] });
  await log.add({ type: 'B' });
  await log.add({ type: 'C' });
  await log.add({ type: 'D' });
  await log.removeReason('test');
  await log.changeMeta('0 test 0', { reasons: [] });
  unsibscribeA();
  await log.add({ type: 'A' });

  equal(events, [
    'A: A',
    'add: A',
    'A clean: A',
    'A: A',
    'add: A',
    'A: A',
    'add: A',
    'B add: B',
    'add: B',
    'C preadd: C',
    'add: C',
    'add: D',
    'A clean: A',
    'A clean: A',
    'add: A',
    'A clean: A',
  ]);
});

test('has type and action.id listener', async () => {
  let events: string[] = [];
  let log = createLog();

  interface A {
    type: 'A';
    name: string;
    id: string;
  }

  log.type<A>('A', (action) => {
    events.push(`A add all ${action.name}`);
  });
  log.type<A>(
    'A',
    (action) => {
      events.push(`A add ID ${action.name}`);
    },
    { id: 'ID' },
  );
  log.type<A>(
    'A',
    (action) => {
      events.push(`A preadd ID ${action.name}`);
    },
    { event: 'preadd', id: 'ID' },
  );

  await log.add({ type: 'A', id: 'ID', name: 'a' });
  await log.add({ type: 'A', id: 'Other', name: 'b' });
  await log.add({ type: 'O', id: 'ID', name: 'c' });

  equal(events, ['A preadd ID a', 'A add ID a', 'A add all a', 'A add all b']);
});

test.run();
