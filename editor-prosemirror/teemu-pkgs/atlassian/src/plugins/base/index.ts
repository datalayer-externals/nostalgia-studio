import { Plugin } from 'prosemirror-state';

import { history } from 'editor-prosemirror/src-pkgs/history/src';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

import { doc, paragraph, text } from '../../schema/nodes';

import { createParagraphNear, splitBlock } from './commands/general';

import { type EditorPlugin, type PMPluginFactory } from '../../types';
// import { keymap } from '../../utils/keymap';

export interface BasePluginOptions {}

export const basePlugin = (options?: BasePluginOptions): EditorPlugin => ({
  name: 'base',

  pmPlugins() {
    const plugins: { name: string; plugin: PMPluginFactory }[] = [
      { name: 'history', plugin: () => history() },
      { name: 'baseKeyMap', plugin: () => keymap(baseKeymap) },
      {
        name: 'otherKeyMap',
        plugin: () =>
          keymap({
            'Ctrl-Alt-p': createParagraphNear,
            'Ctrl-Alt-s': splitBlock,
          }),
      },
    ];

    return plugins;
  },
  nodes() {
    return [
      { name: 'doc', node: doc },
      { name: 'paragraph', node: paragraph },
      { name: 'text', node: text },
    ];
  },
});
