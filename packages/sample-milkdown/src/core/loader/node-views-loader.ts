import { Atom } from '../abstract';
import { LoadState } from '../constant';
import { MarkViewParams, NodeViewParams } from '../utility';

/** 通过reduce收集schema.nodes/marks中view属性配置的NodeView */
export class NodeViewsLoader extends Atom<LoadState.SchemaReady> {
  override readonly id = 'nodeViewsLoader';
  override readonly loadAfter = LoadState.SchemaReady;
  override main() {
    const { nodes, marks, schema, editor } = this.context;
    const nodeViewMap = nodes
      .filter((node) => Boolean(node.view))
      .reduce((acc, cur) => {
        const { view } = cur;
        const node = schema.nodes[cur.id];
        if (!node || !view) return acc;
        return {
          ...acc,
          [cur.id]: (...args: NodeViewParams) => view(editor, node, ...args),
        };
      }, {});

    const markViewMap = marks
      .filter((mark) => Boolean(mark.view))
      .reduce((acc, cur) => {
        const { view } = cur;
        const mark = schema.marks[cur.id];
        if (!mark || !view) return acc;
        return {
          ...acc,
          [cur.id]: (...args: MarkViewParams) => view(editor, mark, ...args),
        };
      }, {});

    const nodeViews = { ...nodeViewMap, ...markViewMap };

    this.updateContext({ nodeViews });
  }
}
