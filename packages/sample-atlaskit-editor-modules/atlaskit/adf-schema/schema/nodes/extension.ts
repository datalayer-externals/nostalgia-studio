import type { NodeSpec, Node as PMNode } from 'prosemirror-model';

import { getExtensionAttrs } from '../../utils/extensions';
import type { DataConsumerDefinition } from '../marks/data-consumer';
import type { ExtensionAttributes } from './types/extensions';
import type { MarksObject, NoMark } from './types/mark';

/**
 * @name extension_node
 */
export interface ExtensionBaseDefinition {
  type: 'extension';
  attrs: ExtensionAttributes;
  marks?: Array<any>;
}

/**
 * @name extension_with_no_marks_node
 */
export type ExtensionDefinition = ExtensionBaseDefinition & NoMark;

/**
 * @name extension_with_marks_node
 * @stage 0
 */
export type ExtensionWithMarksDefinition = ExtensionBaseDefinition &
  MarksObject<DataConsumerDefinition>;

const createExtensionNodeSpec = (): NodeSpec => {
  const nodeSpec: NodeSpec = {
    inline: false,
    group: 'block',
    atom: true,
    selectable: true,
    attrs: {
      extensionType: { default: '' },
      extensionKey: { default: '' },
      parameters: { default: null },
      text: { default: null },
      layout: { default: 'default' },
      localId: { default: null },
    },
    parseDOM: [
      {
        tag: '[data-node-type="extension"]',
        getAttrs: (domNode) => getExtensionAttrs(domNode as HTMLElement),
      },
    ],
    toDOM(node: PMNode) {
      const attrs = {
        'data-node-type': 'extension',
        'data-extension-type': node.attrs.extensionType,
        'data-extension-key': node.attrs.extensionKey,
        'data-text': node.attrs.text,
        'data-parameters': JSON.stringify(node.attrs.parameters),
        'data-layout': node.attrs.layout,
        'data-local-id:': node.attrs.localId,
      };
      return ['div', attrs];
    },
  };

  return nodeSpec;
};

export const extension = createExtensionNodeSpec();
