import { Descendant } from 'slate';

import type {
  CollapsibleElement,
  NestableElement,
} from '../draggable-collapsible-feature/types';
import type { ListVariants } from './utils';

export type ListItemType = 'list_item';

type BaseListItemElement = {
  type: ListItemType;
  children: Descendant[];
} & NestableElement &
  CollapsibleElement;

export type BulletedListItemElement = BaseListItemElement & {
  listType: (typeof ListVariants)['Bulleted'];
};

export type NumberedListItemElement = BaseListItemElement & {
  listType: (typeof ListVariants)['Numbered'];
};

export type CheckboxListItemElement = BaseListItemElement & {
  listType: (typeof ListVariants)['Checkbox'];
  checked: boolean;
};

export type ListItemElement =
  | BulletedListItemElement
  | NumberedListItemElement
  | CheckboxListItemElement;
