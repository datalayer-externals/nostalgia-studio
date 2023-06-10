import React from 'react';
import { EditorState } from 'prosemirror-state';

import { blockquote } from '../../schema/nodes';
import {
  blockQuotePluginFactory,
  blockquotePluginKey,
} from './pm-plugins/main';
import { keymapPlugin } from './pm-plugins/keymap';
import * as keymaps from '../../core/keymaps';

import { type NodeViewProps } from '../../react/ReactNodeView';
import { type EditorPlugin, type PMPluginFactory } from '../../core/types';

export interface BlockQuoteOptions {}
export interface IViewProps {
  options?: BlockQuoteOptions;
}
export type UIProps = NodeViewProps<IViewProps, IBlockQuoteAttrs>;
export interface IBlockQuoteAttrs {
  size: number;
}

export const blockQuotePlugin = (
  options: BlockQuoteOptions = {},
): EditorPlugin => ({
  name: 'blockquote',

  nodes() {
    return [{ name: 'blockquote', node: blockquote }];
  },

  pmPlugins() {
    const plugins: { name: string; plugin: PMPluginFactory }[] = [
      {
        name: 'blockquote',
        plugin: ({ ctx }) => blockQuotePluginFactory(ctx, options),
      },
      { name: 'blockquoteKeyMap', plugin: () => keymapPlugin() },
    ];
    return plugins;
  },

  pluginsOptions: {},
});
