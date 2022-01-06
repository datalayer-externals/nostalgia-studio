import { Mark, MarkType, Node, NodeType } from 'prosemirror-model';

import { maybeMerge } from '../utility/prosemirror';
import { StackElement, createElement } from './stack-element';
import type { Attrs } from './types';

type Ctx = {
  marks: Mark[];
  readonly elements: StackElement[];
};

const size = (ctx: Ctx): number => ctx.elements.length;

const top = (ctx: Ctx): StackElement | undefined => ctx.elements[size(ctx) - 1];

const push = (ctx: Ctx) => (node: Node) => top(ctx)?.push(node);

const openNode = (ctx: Ctx) => (nodeType: NodeType, attrs?: Attrs) =>
  ctx.elements.push(createElement(nodeType, [], attrs));

const addNode =
  (ctx: Ctx) =>
  (nodeType: NodeType, attrs?: Attrs, content?: Node[]): Node => {
    const node = nodeType.createAndFill(attrs, content, ctx.marks);

    if (!node) throw new Error();

    push(ctx)(node);

    return node;
  };

const closeNode = (ctx: Ctx) => (): Node => {
  ctx.marks = Mark.none;
  const element = ctx.elements.pop();

  if (!element) throw new Error();

  return addNode(ctx)(element.type, element.attrs, element.content);
};

const openMark =
  (ctx: Ctx) =>
  (markType: MarkType, attrs?: Attrs): void => {
    const mark = markType.create(attrs);

    ctx.marks = mark.addToSet(ctx.marks);
  };

const closeMark =
  (ctx: Ctx) =>
  (markType: MarkType): void => {
    ctx.marks = markType.removeFromSet(ctx.marks);
  };

const addText =
  (ctx: Ctx) =>
  (createTextNode: (marks: Mark[]) => Node): void => {
    const topElement = top(ctx);
    if (!topElement) throw new Error();

    const prevNode = topElement.pop();
    const currNode = createTextNode(ctx.marks);

    if (!prevNode) {
      topElement.push(currNode);
      return;
    }

    const merged = maybeMerge(prevNode, currNode);
    if (merged) {
      topElement.push(merged);
      return;
    }
    topElement.push(prevNode, currNode);
  };

const build = (ctx: Ctx) => () => {
  let doc: Node | null = null;
  do {
    doc = closeNode(ctx)();
  } while (size(ctx));

  return doc;
};

/** 返回一系列的工具方法，注意原方法都是高阶方法，
 * todo 改写成class更合适
 */
export const createStack = () => {
  const ctx: Ctx = {
    marks: [],
    elements: [],
  };

  return {
    build: build(ctx),
    openMark: openMark(ctx),
    closeMark: closeMark(ctx),
    addText: addText(ctx),
    openNode: openNode(ctx),
    addNode: addNode(ctx),
    closeNode: closeNode(ctx),
  };
};

export type Stack = ReturnType<typeof createStack>;
