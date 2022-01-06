import { MarkParserSpec, MarkSerializerSpec } from '../../core';
import { toggleMark } from 'prosemirror-commands';
import type { InputRule } from 'prosemirror-inputrules';
import type { MarkSpec, MarkType } from 'prosemirror-model';
import { SupportedKeys } from '../supported-keys';
import { BaseMark, markRule } from '../utility';

type Keys = SupportedKeys.Bold;

export class Strong extends BaseMark<Keys> {
  override readonly id = 'strong';
  override readonly schema: MarkSpec = {
    parseDOM: [
      { tag: 'b' },
      { tag: 'strong' },
      { style: 'font-style', getAttrs: (value) => (value === 'bold') as false },
    ],
    toDOM: (mark) => ['strong', { class: this.getClassName(mark.attrs) }],
  };
  override readonly parser: MarkParserSpec = {
    match: (node) => node.type === 'strong',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  };
  override readonly serializer: MarkSerializerSpec = {
    match: (mark) => mark.type.name === this.id,
    runner: (state, mark) => {
      state.withMark(mark, 'strong');
    },
  };
  override readonly inputRules = (markType: MarkType): InputRule[] => [
    markRule(/(?:__)([^_]+)(?:__)$/, markType),
    markRule(/(?:\*\*)([^*]+)(?:\*\*)$/, markType),
  ];
  override readonly commands: BaseMark<Keys>['commands'] = (
    markType: MarkType,
  ) => ({
    [SupportedKeys.Bold]: {
      defaultKey: 'Mod-b',
      command: toggleMark(markType),
    },
  });
}
