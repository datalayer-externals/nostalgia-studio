import { equal, instance, is } from 'uvu/assert';
import { test } from 'uvu';

import { MemoryStore, TestTime } from '../index';

test('creates test log', () => {
  let log = TestTime.getLog();
  equal(log.nodeId, 'test1');
  instance(log.store, MemoryStore);
});

test('creates test log with specific parameters', () => {
  let store = new MemoryStore();
  let log = TestTime.getLog({ store, nodeId: 'other' });
  equal(log.nodeId, 'other');
  is(log.store, store);
});

test('uses special ID generator in test log', async () => {
  let log = TestTime.getLog();
  await Promise.all([
    log.add({ type: 'a' }, { reasons: ['test'] }),
    log.add({ type: 'b' }, { reasons: ['test'] }),
  ]);
  equal(log.entries(), [
    [{ type: 'a' }, { added: 1, time: 1, id: '1 test1 0', reasons: ['test'] }],
    [{ type: 'b' }, { added: 2, time: 2, id: '2 test1 0', reasons: ['test'] }],
  ]);
});

test('creates test logs with same time', async () => {
  let time = new TestTime();
  let log1 = time.nextLog();
  let log2 = time.nextLog();

  equal(log1.nodeId, 'test1');
  equal(log2.nodeId, 'test2');

  await Promise.all([
    log1.add({ type: 'a' }, { reasons: ['test'] }),
    log2.add({ type: 'b' }, { reasons: ['test'] }),
  ]);
  equal(log1.entries(), [
    [{ type: 'a' }, { added: 1, time: 1, id: '1 test1 0', reasons: ['test'] }],
  ]);
  equal(log2.entries(), [
    [{ type: 'b' }, { added: 1, time: 2, id: '2 test2 0', reasons: ['test'] }],
  ]);
});

test('creates log with test shortcuts', () => {
  let log = TestTime.getLog();
  log.add({ type: 'A' }, { reasons: ['t'] });
  equal(log.actions(), [{ type: 'A' }]);
  equal(log.entries(), [
    [{ type: 'A' }, { id: '1 test1 0', time: 1, added: 1, reasons: ['t'] }],
  ]);
});

test('keeps actions on request', async () => {
  let log = TestTime.getLog();

  await log.add({ type: 'a' });
  equal(log.actions(), []);

  log.keepActions();
  await log.add({ type: 'b' });
  equal(log.actions(), [{ type: 'b' }]);
});

test.run();
