import { type Node as PMNode } from 'prosemirror-model';
import {
  type Decoration,
  type DecorationSource,
  type EditorView,
  type NodeView,
} from 'prosemirror-view';

import { type EditorContext } from '../../../context';
import { ReactNodeView } from '../../../react';
import { BlockQuote } from '../ui/BlockQuote';
import {
  type BlockQuoteOptions,
  type IBlockQuoteAttrs,
  type IViewProps,
} from '..';

export class BlockQuoteView extends ReactNodeView<
  IViewProps,
  IBlockQuoteAttrs
> {
  createContentDOM() {
    const contentDOM = document.createElement('div');
    contentDOM.classList.add(`${this.node.type.name}__content-dom`);
    return contentDOM;
  }
}

export function blockQuoteNodeView(
  ctx: EditorContext,
  options?: BlockQuoteOptions,
) {
  return (
    node: PMNode,
    view: EditorView,
    getPos: () => number,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
  ): NodeView =>
    new BlockQuoteView(
      node,
      view,
      getPos,
      decorations,
      innerDecorations,
      ctx,
      {
        options,
      },
      BlockQuote,
    ).init();
}
