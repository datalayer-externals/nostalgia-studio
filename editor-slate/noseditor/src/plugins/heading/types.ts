import { Descendant } from 'slate';

import { FoldingElement } from '../../slate-extended/types';

export const Heading1Type: Heading1Type = 'h1';
export const Heading2Type: Heading2Type = 'h2';
export const Heading3Type: Heading3Type = 'h3';

export type Heading1Type = 'h1';
export type Heading2Type = 'h2';
export type Heading3Type = 'h3';

export type Heading1Element = {
  // id: string;
  type: Heading1Type;
  children: Descendant[];
} & FoldingElement;

export type Heading2Element = {
  // id: string;
  type: Heading2Type;
  children: Descendant[];
} & FoldingElement;

export type Heading3Element = {
  // id: string;
  type: Heading3Type;
  children: Descendant[];
} & FoldingElement;
