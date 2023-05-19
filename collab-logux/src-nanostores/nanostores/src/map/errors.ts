import { map } from '../index';

type TestType =
  | { id: string; isLoading: true }
  | { isLoading: false; a: string; b: number; c?: number };

let test = map<TestType>();

test.subscribe((_, changedKey) => {
  if (changedKey === 'a') {
  }
  // THROWS have no overlap
  if (changedKey === 'z') {
  }
});

test.listen((_, changedKey) => {
  if (changedKey === 'a') {
  }
  // THROWS have no overlap
  if (changedKey === 'z') {
  }
});

test.setKey('isLoading', true);
test.setKey('id', '123');
test.setKey('c', 5);
test.setKey('c', undefined);
// THROWS Argument of type '"z"' is not assignable to parameter
test.setKey('z', '123');

test.setKey('isLoading', false);
test.setKey('a', 'string');
test.setKey('b', 5);
// THROWS Argument of type '"z"' is not assignable to parameter
test.setKey('z', '123');
