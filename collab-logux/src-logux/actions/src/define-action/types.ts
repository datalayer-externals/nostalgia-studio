import { type Action } from '@logux/core';

import { defineAction } from '../index';

type RenameAction = {
  type: 'rename';
  name: string;
};
let rename = defineAction<RenameAction>('rename');

function processAction(action: Action): void {
  if (rename.match(action)) {
    console.log(action.name);
  }
}

processAction({ type: 'other' });
