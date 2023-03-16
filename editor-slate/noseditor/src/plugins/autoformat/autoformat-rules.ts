import { Editor } from 'slate';

import { AutoformatRule } from '@udecode/plate-autoformat';

import { BlockquoteType } from '../blockquote/types';
import { Heading1Type, Heading2Type, Heading3Type } from '../heading/types';
import { toggleList } from '../list/transforms';
import { ListItemType, ListTypes } from '../list/types';

export const autoformatRules: AutoformatRule[] = [
  {
    mode: 'block',
    type: Heading1Type,
    match: '# ',
  },
  {
    mode: 'block',
    type: Heading2Type,
    match: '## ',
  },
  {
    mode: 'block',
    type: Heading3Type,
    match: '### ',
  },
  {
    mode: 'block',
    type: BlockquoteType,
    match: '> ',
  },
  {
    mode: 'block',
    type: ListItemType,
    match: ['* ', '- '],
    format: (editor: Editor) => {
      toggleList(editor, { listType: ListTypes.Bulleted });
    },
  },
  {
    mode: 'block',
    type: ListItemType,
    match: ['1. ', '1) '],
    format: (editor: Editor) => {
      toggleList(editor, { listType: ListTypes.Numbered });
    },
  },
  {
    mode: 'block',
    type: ListItemType,
    match: ['[] ', 'x ', 'X '],
    format: (editor: Editor) => {
      toggleList(editor, { listType: ListTypes.TodoList });
    },
  },
];
