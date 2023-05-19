import { LoguxError, TestPair, TestTime, TestLog } from '@logux/core';
import { it, afterEach, expect } from 'vitest';
import { delay } from 'nanodelay';

import { CrossTabClient, badge, badgeEn, ClientMeta } from '../index';
import { BadgeOptions } from './index';
import { badgeStyles } from './styles/index';

function badgeNode(): HTMLElement | null {
  return document.querySelector('div')!;
}

function badgeChildStyle(): any {
  let node = badgeNode();
  if (node !== null) {
    let child = node.children[0];
    if (child instanceof HTMLElement) {
      return child.style;
    }
  }
  return {};
}

function badgeStyle(): any {
  let node = badgeNode();
  return node !== null ? node.style : {};
}

function getBadgeMessage(): string {
  return badgeNode()?.children[0].innerHTML ?? 'NO BADGE';
}

function setState(node: any, state: string): void {
  node.setState(state);
}

function emit(obj: any, event: string, ...args: any[]): void {
  obj.emitter.emit(event, ...args);
}

async function createTest(override?: Partial<BadgeOptions>): Promise<TestPair> {
  let pair = new TestPair();
  let client = new CrossTabClient<{}, TestLog<ClientMeta>>({
    subprotocol: '1.0.0',
    server: pair.left,
    userId: '1',
    time: new TestTime(),
  });

  client.role = 'leader';
  client.node.catch(() => true);

  pair.leftNode = client.node;

  pair.leftNode.catch(() => true);
  await pair.left.connect();
  let opts: BadgeOptions = { messages: badgeEn, styles: badgeStyles };
  Object.assign(opts, override);
  badge(client, opts);
  return pair;
}

afterEach(() => {
  let node = badgeNode();
  if (node !== null) document.body.removeChild(node);
});

it('injects base widget styles', async () => {
  await createTest();
  expect(badgeStyle().position).toBe('fixed');
  expect(badgeChildStyle().verticalAlign).toBe('middle');
});

it('shows synchronized state', async () => {
  let test = await createTest({ duration: 10 });

  test.leftNode.connected = true;
  setState(test.leftNode, 'synchronized');
  expect(badgeStyle().display).toBe('none');

  test.leftNode.connected = false;
  setState(test.leftNode, 'disconnected');
  await test.leftNode.log.add({ type: 'A' }, { sync: true, reasons: ['t'] });

  setState(test.leftNode, 'connecting');
  test.leftNode.connected = true;
  setState(test.leftNode, 'sending');
  setState(test.leftNode, 'synchronized');
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/refresh.svg")');
  test.leftNode.log.add({ type: 'logux/processed', id: '1 1:1:1 0' });
  await delay(1);

  expect(getBadgeMessage()).toEqual(badgeEn.synchronized);
  await delay(10);

  expect(badgeStyle().display).toBe('none');
});

it('shows disconnected state', async () => {
  let test = await createTest();
  test.leftNode.connected = true;
  setState(test.leftNode, 'connected');
  test.leftNode.connected = false;
  setState(test.leftNode, 'disconnected');
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/offline.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.disconnected);
});

it('shows wait state', async () => {
  let test = await createTest();
  test.leftNode.connected = false;
  setState(test.leftNode, 'disconnected');
  setState(test.leftNode, 'wait');
  await test.leftNode.log.add({ type: 'A' }, { sync: true, reasons: ['t'] });
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/offline.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.wait);
});

it('shows sending state', async () => {
  let test = await createTest();

  test.leftNode.connected = false;
  setState(test.leftNode, 'disconnected');
  setState(test.leftNode, 'connecting');
  expect(getBadgeMessage()).toEqual(badgeEn.disconnected);

  test.leftNode.connected = false;
  setState(test.leftNode, 'wait');
  await test.leftNode.log.add({ type: 'A' }, { sync: true, reasons: ['t'] });

  setState(test.leftNode, 'connecting');
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/offline.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.wait);
  await delay(105);

  expect(getBadgeMessage()).toEqual(badgeEn.sending);
  setState(test.leftNode, 'sending');
  expect(getBadgeMessage()).toEqual(badgeEn.sending);
});

it('shows error', async () => {
  let test = await createTest();
  emit(test.leftNode, 'error', { type: 'any error' });
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/error.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.syncError);
});

it('shows server errors', async () => {
  let test = await createTest();
  let protocol = new LoguxError('wrong-protocol', {
    supported: '1.0.0',
    used: '0.1.0',
  });
  emit(test.leftNode, 'error', protocol);
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/refresh.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.protocolError);

  let subprotocol = new LoguxError('wrong-subprotocol', {
    supported: '1.0.0',
    used: '0.1.0',
  });
  emit(test.leftNode, 'error', subprotocol);
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/refresh.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.protocolError);
});

it('shows client error', async () => {
  let test = await createTest();
  let error = new LoguxError('timeout', 10, true);
  emit(test.leftNode, 'clientError', error);

  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/error.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.syncError);
});

it('shows error undo actions', async () => {
  let test = await createTest();
  test.leftNode.log.add({ type: 'logux/undo', reason: 'error' });
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/error.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.error);
});

it('shows denied undo actions', async () => {
  let test = await createTest();
  test.leftNode.log.add({ type: 'logux/undo', reason: 'denied' });
  expect(badgeStyle().display).toBe('block');
  expect(badgeStyle().backgroundImage).toBe('url("/badge/styles/error.svg")');
  expect(getBadgeMessage()).toEqual(badgeEn.denied);
});

it('supports bottom and left side of position setting', async () => {
  await createTest({ position: 'bottom-left' });
  expect(badgeStyle().bottom).toBe('0px');
  expect(badgeStyle().left).toBe('0px');
});

it('supports middle and right side of position setting', async () => {
  await createTest({ position: 'middle-right' });
  expect(badgeStyle().top).toBe('50%');
  expect(badgeStyle().right).toBe('0px');
  expect(badgeStyle().transform).toBe('translateY(-50%)');
});

it('supports bottom and center side of position setting', async () => {
  await createTest({ position: 'bottom-center' });
  expect(badgeStyle().bottom).toBe('0px');
  expect(badgeStyle().left).toBe('50%');
  expect(badgeStyle().transform).toBe('translateX(-50%)');
});

it('supports middle-center position setting', async () => {
  await createTest({ position: 'middle-center' });
  expect(badgeStyle().top).toBe('50%');
  expect(badgeStyle().left).toBe('50%');
  expect(badgeStyle().transform).toBe('translate(-50%, -50%)');
});

it('removes badge from DOM', () => {
  let pair = new TestPair();
  let client = new CrossTabClient({
    subprotocol: '1.0.0',
    server: pair.left,
    userId: '10',
    time: new TestTime(),
  });

  let opts = { messages: badgeEn, styles: badgeStyles };
  let unbind = badge(client, opts);

  unbind();

  expect(badgeNode()).toBeNull();
  emit(client.node, 'error', { type: 'wrong-protocol' });
});
