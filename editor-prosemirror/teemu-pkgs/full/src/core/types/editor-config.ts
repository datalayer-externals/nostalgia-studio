import { type NodeView } from 'prosemirror-view';
import { type MarkSpec, type NodeSpec } from 'prosemirror-model';

import { type PMPlugin } from './pm-plugin';

export interface EditorConfig {
  nodes: NodeConfig[];
  marks: MarkConfig[];
  pmPlugins: PMPlugin[];
}

export interface NodeConfig {
  name: string;
  node: NodeSpec;
}

export interface MarkConfig {
  name: string;
  mark: MarkSpec;
}

export interface NodeViewConfig {
  name: string;
  nodeView: NodeView;
}
