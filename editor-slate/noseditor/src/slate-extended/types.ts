import { BaseElement, Element } from 'slate';

export interface IdentityElement {
  id?: string;
}

export interface HashedElement {
  hash?: string;
}

export type FoldingElement = {
  folded?: boolean;
  foldedCount?: number;
};

export type NestingElement = {
  depth: number;
};

/**
 * slateElement with dragSortInfo
 */
export type SemanticNode<T extends Element = Element> = {
  element: T;
  children: SemanticNode[];
  index: number;
  listIndex: number;
  hidden: boolean;
  folded: SemanticNode | undefined;
  descendants: SemanticNode[];
};
