import { equal, is } from 'uvu/assert';
import { test } from 'uvu';

import { getPath, setPath } from './path';

test('path evaluates correct value', () => {
  let exampleObj = {
    a: '123',
    b: { c: 123, d: [{ e: 123 }] },
  };

  equal(getPath(exampleObj, 'a'), '123');
  equal(getPath(exampleObj, 'b.c'), 123);
  equal(getPath(exampleObj, 'b.d[0]'), { e: 123 });
  equal(getPath(exampleObj, 'b.d[0].e'), 123);

  // @ts-expect-error: incorrect key here
  equal(getPath(exampleObj, 'abra.cadabra.booms'), undefined);
});

test('simple path setting', () => {
  type TestObj = {
    a: {
      b?: { c: string; d: { e: string }[] };
      e: number;
    };
    f: string;
  };
  let initial: TestObj = { a: { e: 123 }, f: '' };

  initial = setPath(initial, 'f', 'hey');
  initial = setPath(initial, 'f', 'hey');
  equal(initial, { a: { e: 123 }, f: 'hey' });
});

test('creating objects', () => {
  type TestObj = { a?: { b?: { c?: { d: string } } } };
  let initial: TestObj = {};

  setPath(initial, 'a.b.c.d', 'val');
  equal(initial.a?.b?.c?.d, 'val');
});

test('creating arrays', () => {
  type TestObj = { a?: string[] };
  let initial: TestObj = {};

  setPath(initial, 'a[0]', 'val');
  equal(initial, { a: ['val'] });
  setPath(initial, 'a[3]', 'val3');
  equal(initial, { a: ['val', undefined, undefined, 'val3'] });
});

test('removes arrays', () => {
  type TestObj = { a?: string[] };
  let initial: TestObj = { a: ['a', 'b'] };

  // @ts-expect-error: incorrect key here
  setPath(initial, 'a[1]', undefined);
  equal(initial, { a: ['a'] });

  // @ts-expect-error: incorrect key here
  setPath(initial, 'a[0]', undefined);
  equal(initial, { a: [] });
});

test('changes object reference, when this level key is changed', () => {
  type Obj = { a: { b: { c: number; d: string }; e: number } };
  let b = { c: 1, d: '1' };
  let a = { b, e: 1 };

  let initial: Obj = { a };

  setPath(initial, 'a.b.c', 2);
  is(initial.a, a);
  is.not(initial.a.b, b);

  setPath(initial, 'a.e', 2);
  is.not(initial.a, a);
});

test('array items mutation changes identity on the same level', () => {
  let arr1 = { a: 1 };
  let arr2 = { a: 2 };
  let d = [arr1, arr2];
  let c = { d };

  let initial = { a: { b: { c } } };
  {
    let newInitial = setPath(initial, 'a.b.c.d[1].a', 3);
    is(newInitial.a.b.c.d, d);
    is(newInitial.a.b.c.d[0], d[0]);
    is.not(newInitial.a.b.c.d[1], arr2);
    equal(newInitial.a.b.c.d[1], { a: 3 });
  }
});

test.run();
