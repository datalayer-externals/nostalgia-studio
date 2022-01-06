import type { NodeParserSpec, NodeSerializerSpec } from '../../core';
import { InputRule } from 'prosemirror-inputrules';
import type { NodeSpec, NodeType } from 'prosemirror-model';
import { BaseNode } from '../utility';

export class Image extends BaseNode {
  override readonly id = 'image';
  override readonly schema: NodeSpec = {
    inline: true,
    attrs: {
      src: { default: '' },
      alt: { default: null },
      title: { default: null },
    },
    group: 'inline',
    draggable: true,
    marks: '',
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            throw new Error();
          }
          return {
            src: dom.getAttribute('src') || '',
            alt: dom.getAttribute('alt'),
            title: dom.getAttribute('title'),
          };
        },
      },
    ],
    toDOM: (node) => {
      if (node.attrs.src?.length > 0) {
        return ['img', { ...node.attrs, class: this.getClassName(node.attrs) }];
      }
      return [
        'div',
        { ...node.attrs, class: this.getClassName(node.attrs, 'image empty') },
        ['span', { contentEditable: 'false', class: 'icon' }],
        ['span', { contentEditable: 'false', class: 'placeholder' }],
      ];
    },
  };
  override readonly parser: NodeParserSpec = {
    match: ({ type }) => type === this.id,
    runner: (state, node, type) => {
      const url = node.url as string;
      const alt = node.alt as string;
      const title = node.title as string;
      state.openNode(type, {
        src: url,
        alt,
        title,
      });
      state.next(node.children);
      state.closeNode();
    },
  };
  override readonly serializer: NodeSerializerSpec = {
    match: (node) => node.type.name === this.id,
    runner: (state, node) => {
      state.addNode('image', undefined, undefined, {
        title: node.attrs.title,
        url: node.attrs.src,
        alt: node.attrs.alt,
      });
    },
  };
  override readonly inputRules = (nodeType: NodeType) => [
    new InputRule(
      /!\[(?<alt>.*?)]\((?<filename>.*?)(?=“|\))"?(?<title>[^"]+)?"?\)/,
      (state, match, start, end) => {
        const [okay, alt, src = '', title] = match;
        const { tr } = state;
        if (okay) {
          tr.replaceWith(start, end, nodeType.create({ src, alt, title }));
        }

        return tr;
      },
    ),
  ];
}
