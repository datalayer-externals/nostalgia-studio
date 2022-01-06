import type {
  Fragment,
  Mark as ProseMark,
  Node as ProseNode,
  Schema,
} from 'prosemirror-model';
import type { RemarkOptions } from 'remark';
import type { Processor } from 'unified';

import type { Stack } from './stack';
import type { InnerSerializerSpecMap, SerializerSpecWithType } from './types';

const isFragment = (x: ProseNode | Fragment): x is Fragment =>
  Object.prototype.hasOwnProperty.call(x, 'size');

type StateMethod<T extends keyof Stack> = (
  ...args: Parameters<Stack[T]>
) => State;

/** serializer state is used to generate the remark AST,
it provides several useful methods to make the transformation pretty simple.  */
export class State {
  constructor(
    private readonly stack: Stack,
    public readonly schema: Schema,
    private readonly specMap: InnerSerializerSpecMap,
  ) {}

  #matchTarget(
    node: ProseMark | ProseNode,
  ): SerializerSpecWithType & { key: string } {
    const result = Object.entries(this.specMap)
      .map(([key, spec]) => ({
        key,
        ...spec,
      }))
      .find((x) => x.match(node as ProseMark & ProseNode));

    if (!result) throw new Error();

    return result;
  }

  #runProse(node: ProseMark | ProseNode) {
    const { runner } = this.#matchTarget(node);
    runner(this, node as ProseNode & ProseMark);
  }

  #runNode(node: ProseNode) {
    const { marks } = node;
    marks.forEach((mark) => this.#runProse(mark));
    this.#runProse(node);
    marks.forEach((mark) => this.stack.closeMark(mark));
  }

  run(tree: ProseNode) {
    this.next(tree);

    return this;
  }

  next = (node: ProseNode | Fragment) => {
    if (isFragment(node)) {
      node.forEach((n) => {
        this.#runNode(n);
      });
      return this;
    }
    this.#runNode(node);
    return this;
  };

  addNode: StateMethod<'addNode'> = (...args) => {
    this.stack.addNode(...args);
    return this;
  };

  openNode: StateMethod<'openNode'> = (...args) => {
    this.stack.openNode(...args);
    return this;
  };

  closeNode: StateMethod<'closeNode'> = (...args) => {
    this.stack.closeNode(...args);
    return this;
  };

  /** 实际执行remark.stringify() */
  toString = (remark: Processor<RemarkOptions>): string =>
    remark.stringify(this.stack.build());

  withMark: StateMethod<'openMark'> = (...args) => {
    this.stack.openMark(...args);
    return this;
  };
}
