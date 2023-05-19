import { equal, is, ok, throws } from 'uvu/assert';
import { delay } from 'nanodelay';
import { spyOn } from 'nanospy';
import { test } from 'uvu';

import { ServerNode, TestTime, TestPair } from '../index';

let node: ServerNode;
test.after.each(() => {
  node.destroy();
});

function privateMethods(obj: object): any {
  return obj;
}

test('has connecting state from the beginning', () => {
  let pair = new TestPair();
  pair.right.connect();
  node = new ServerNode('server', TestTime.getLog(), pair.left);
  equal(node.state, 'connecting');
});

test('destroys on disconnect', async () => {
  let pair = new TestPair();
  node = new ServerNode('server', TestTime.getLog(), pair.left);
  let destroy = spyOn(node, 'destroy');
  await pair.left.connect();
  pair.left.disconnect();
  equal(destroy.callCount, 1);
});

test('destroys on connect timeout', async () => {
  let log = TestTime.getLog();
  let pair = new TestPair();
  node = new ServerNode('server', log, pair.left, { timeout: 200 });

  let error: Error | undefined;
  node.catch((err) => {
    error = err;
  });

  let destroy = spyOn(node, 'destroy');
  await pair.left.connect();
  equal(destroy.callCount, 0);
  await delay(200);
  if (typeof error === 'undefined') throw new Error('Error was not sent');
  ok(error.message.includes('timeout'));
  equal(destroy.callCount, 1);
});

test('throws on fixTime option', () => {
  let log = TestTime.getLog();
  let pair = new TestPair();
  throws(() => {
    new ServerNode('a', log, pair.left, { fixTime: true });
  }, /fixTime/);
});

test('loads only last added from store', async () => {
  let log = TestTime.getLog();
  let pair = new TestPair();
  log.store.setLastSynced({ sent: 1, received: 2 });
  await log.add({ type: 'a' }, { reasons: ['test'] });
  node = new ServerNode('server', log, pair.left);
  await node.initializing;
  equal(privateMethods(node).lastAddedCache, 1);
  equal(node.lastSent, 0);
  equal(node.lastReceived, 0);
});

test('supports connection before initializing', async () => {
  let log = TestTime.getLog();

  let returnLastAdded: (added: number) => void = () => {
    throw new Error('getLastAdded was not called');
  };
  log.store.getLastAdded = () =>
    new Promise((resolve) => {
      returnLastAdded = resolve;
    });

  let pair = new TestPair();
  node = new ServerNode('server', log, pair.left, { timeout: 50, ping: 50 });

  await pair.right.connect();
  pair.right.send(['connect', node.localProtocol, 'client', 0]);
  await delay(70);
  equal(pair.leftSent, []);
  returnLastAdded(10);
  await delay(70);
  is(node.connected, true);
  equal(pair.leftSent.length, 2);
  equal(pair.leftSent[0][0], 'connected');
  equal(pair.leftSent[1], ['ping', 10]);
});

test.run();
