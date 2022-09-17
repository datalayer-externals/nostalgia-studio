import { Mark } from './mark';
import { Node } from './node';

/** You can [_resolve_](#model.Node.resolve) a position to get more
 * information about it. Objects of this class represent such a
 * resolved position, providing various pieces of context
 * information, and some helper methods.
 *
 * Throughout this interface, methods that take an optional `depth`
 * parameter will interpret undefined as `this.depth` and negative
 * numbers as `this.depth + value`.
 * - 可以获取当前选区位置在文档中的各种信息，包括位置，当前相对于上层元素的路径，相邻元素等等信息
 */
export class ResolvedPos {
  /** The number of levels the parent node is from the root. If this
   * position points directly into the root node, it is 0. If it
   * points into a top-level paragraph, 1, and so on.
   * - 非文本节点才有深度；如果是文本节点的话ResolvedPos.depth表示的是其父节点（block类型）的深度。
   */
  depth: number;

  /// @internal
  constructor(
    /** The position that was resolved. */
    readonly pos: number,
    /// @internal
    readonly path: any[],
    /** The offset this position has into its parent node. 在父节点中的偏移 */
    readonly parentOffset: number,
  ) {
    this.depth = path.length / 3 - 1;
  }

  /// @internal
  resolveDepth(val: number | undefined | null) {
    if (val == null) return this.depth;
    if (val < 0) return this.depth + val;
    return val;
  }

  /** The parent node that the position points into. Note that even if
   * a position points into a text node, that node is not considered
   * the parent—text nodes are ‘flat’ in this model, and have no content.
   * - 直接调用 this.node()
   */
  get parent() {
    return this.node(this.depth);
  }

  /** The root node in which the position was resolved. */
  get doc() {
    return this.node(0);
  }

  /** The ancestor node at the given level. `p.node(p.depth)` is the
   * same as `p.parent`. 返回其父节点
   */
  node(depth?: number | null): Node {
    return this.path[this.resolveDepth(depth) * 3];
  }

  /** The index into the ancestor at the given level. If this points
   * at the 3rd node in the 2nd paragraph on the top level, for
   * example, `p.index(0)` is 1 and `p.index(1)` is 2.
   * - 返回当前节点在父节点中的索引，从0开始
   */
  index(depth?: number | null): number {
    return this.path[this.resolveDepth(depth) * 3 + 1];
  }

  /** The index pointing after this position into the ancestor at the given level.
   * - 返回下一个兄弟节点的索引，（注意：下一个兄弟节点不一定存在，ResolvedPos.indexAfter()更像是ResolvedPos.index()+1）
   */
  indexAfter(depth?: number | null): number {
    depth = this.resolveDepth(depth);
    return (
      this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1)
    );
  }

  /** The (absolute) position at the start of the node at the given level.
   * - 返回父节点内容的开始位置
   */
  start(depth?: number | null): number {
    depth = this.resolveDepth(depth);
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
  }

  /** The (absolute) position at the end of the node at the given level.
   * - 返回父节点的内容的结束位置
   */
  end(depth?: number | null): number {
    depth = this.resolveDepth(depth);
    return this.start(depth) + this.node(depth).content.size;
  }

  /** The (absolute) position directly before the wrapping node at the
   * given level, or, when `depth` is `this.depth + 1`, the original
   * position.
   * - 等于ResolvedPos.start()-1
   */
  before(depth?: number | null): number {
    depth = this.resolveDepth(depth);
    if (!depth)
      throw new RangeError('There is no position before the top-level node');
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
  }

  /** The (absolute) position directly after the wrapping node at the
   * given level, or the original position when `depth` is `this.depth + 1`.
   * - 等于ResolvedPos.end()+1
   */
  after(depth?: number | null): number {
    depth = this.resolveDepth(depth);
    if (!depth)
      throw new RangeError('There is no position after the top-level node');
    return depth == this.depth + 1
      ? this.pos
      : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
  }

  /** When this position points into a text node, this returns the
   * distance between the position and the start of the text node.
   * Will be zero for positions that point between nodes.
   * - 返回当前位置在文本节点中的偏移
   */
  get textOffset(): number {
    return this.pos - this.path[this.path.length - 1];
  }

  /** Get the node directly after the position, if any. If the position
   * points into a text node, only the part of that node after the
   * position is returned.
   * - 返回当前位置之后的文本节点的切片。
   */
  get nodeAfter(): Node | null {
    const parent = this.parent;
      const index = this.index(this.depth);
    if (index == parent.childCount) return null;
    const dOff = this.pos - this.path[this.path.length - 1];
      const child = parent.child(index);
    return dOff ? parent.child(index).cut(dOff) : child;
  }

  /** Get the node directly before the position, if any. If the
   * position points into a text node, only the part of that node
   * before the position is returned.
   * - 返回当前位置之前的文本节点的切片
   */
  get nodeBefore(): Node | null {
    const index = this.index(this.depth);
    const dOff = this.pos - this.path[this.path.length - 1];
    if (dOff) return this.parent.child(index).cut(0, dOff);
    return index == 0 ? null : this.parent.child(index - 1);
  }

  /** Get the position at the given index in the parent node at the
   * given depth (which defaults to `this.depth`).
   */
  posAtIndex(index: number, depth?: number | null): number {
    depth = this.resolveDepth(depth);
    const node = this.path[depth * 3];
      let pos = depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
    for (let i = 0; i < index; i++) pos += node.child(i).nodeSize;
    return pos;
  }

  /** Get the marks at this position, factoring in the surrounding
   * marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
   * position is at the start of a non-empty node, the marks of the
   * node after it (if any) are returned.
   * - 返回当前文本节点上应用的标记集合。
   */
  marks(): readonly Mark[] {
    const parent = this.parent;
      const index = this.index();

    // In an empty parent, return the empty array
    if (parent.content.size == 0) return Mark.none;

    // When inside a text node, just return the text node's marks
    if (this.textOffset) return parent.child(index).marks;

    let main = parent.maybeChild(index - 1);
      let other = parent.maybeChild(index);
    // If the `after` flag is true of there is no node before, make
    // the node after this position the main reference.
    if (!main) {
      const tmp = main;
      main = other;
      other = tmp;
    }

    // Use all marks in the main node, except those that have
    // `inclusive` set to false and are not present in the other node.
    let marks = main!.marks;
    for (let i = 0; i < marks.length; i++)
      if (
        marks[i].type.spec.inclusive === false &&
        (!other || !marks[i].isInSet(other.marks))
      )
        marks = marks[i--].removeFromSet(marks);

    return marks;
  }

  /** Get the marks after the current position, if any, except those
   * that are non-inclusive and not present at position `$end`. This
   * is mostly useful for getting the set of marks to preserve after a
   * deletion. Will return `null` if this position is at the end of
   * its parent node or its parent node isn't a textblock (in which
   * case no marks should be preserved).
   * - 返回从此位置，到另外一个位置的范围内的标记集合。
   */
  marksAcross($end: ResolvedPos): readonly Mark[] | null {
    const after = this.parent.maybeChild(this.index());
    if (!after || !after.isInline) return null;

    let marks = after.marks;
      const next = $end.parent.maybeChild($end.index());
    for (let i = 0; i < marks.length; i++)
      if (
        marks[i].type.spec.inclusive === false &&
        (!next || !marks[i].isInSet(next.marks))
      )
        marks = marks[i--].removeFromSet(marks);
    return marks;
  }

  /** The depth up to which this position and the given (non-resolved)
   * position share the same parent nodes.
   * - 返回当前位置与另外一个位置的共有深度（多少共同的父节点）
   */
  sharedDepth(pos: number): number {
    for (let depth = this.depth; depth > 0; depth--)
      if (this.start(depth) <= pos && this.end(depth) >= pos) return depth;
    return 0;
  }

  /** Returns a range based on the place where this position and the
   * given position diverge around block content. If both point into
   * the same textblock, for example, a range around that textblock
   * will be returned. If they point into different blocks, the range
   * around those blocks in their shared ancestor is returned. You can
   * pass in an optional predicate that will be called with a parent
   * node to see if a range into that parent is acceptable.
   */
  blockRange(
    other: ResolvedPos = this,
    pred?: (node: Node) => boolean,
  ): NodeRange | null {
    if (other.pos < this.pos) return other.blockRange(this);
    for (
      let d =
        this.depth -
        (this.parent.inlineContent || this.pos == other.pos ? 1 : 0);
      d >= 0;
      d--
    )
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d))))
        return new NodeRange(this, other, d);
    return null;
  }

  /** Query whether the given position shares the same parent node. */
  sameParent(other: ResolvedPos): boolean {
    return this.pos - this.parentOffset == other.pos - other.parentOffset;
  }

  /** Return the greater of this and the given position. */
  max(other: ResolvedPos): ResolvedPos {
    return other.pos > this.pos ? other : this;
  }

  /** Return the smaller of this and the given position. */
  min(other: ResolvedPos): ResolvedPos {
    return other.pos < this.pos ? other : this;
  }

  /// @internal
  toString() {
    let str = '';
    for (let i = 1; i <= this.depth; i++)
      str +=
        (str ? '/' : '') + this.node(i).type.name + '_' + this.index(i - 1);
    return str + ':' + this.parentOffset;
  }

  /// @internal
  static resolve(doc: Node, pos: number): ResolvedPos {
    if (!(pos >= 0 && pos <= doc.content.size))
      throw new RangeError('Position ' + pos + ' out of range');
    const path = [];
    let start = 0;
      let parentOffset = pos;
    for (let node = doc; ; ) {
      const { index, offset } = node.content.findIndex(parentOffset);
      const rem = parentOffset - offset;
      path.push(node, index, start + offset);
      if (!rem) break;
      node = node.child(index);
      if (node.isText) break;
      parentOffset = rem - 1;
      start += offset + 1;
    }
    return new ResolvedPos(pos, path, parentOffset);
  }

  /// @internal
  static resolveCached(doc: Node, pos: number): ResolvedPos {
    for (let i = 0; i < resolveCache.length; i++) {
      const cached = resolveCache[i];
      if (cached.pos == pos && cached.doc == doc) return cached;
    }
    const result = (resolveCache[resolveCachePos] = ResolvedPos.resolve(
      doc,
      pos,
    ));
    resolveCachePos = (resolveCachePos + 1) % resolveCacheSize;
    return result;
  }
}

const resolveCache: ResolvedPos[] = [];
let resolveCachePos = 0;
const resolveCacheSize = 12;

/** Represents a flat range of content, i.e. one that starts and
 * ends in the same node.
 */
export class NodeRange {
  /// Construct a node range. `$from` and `$to` should point into the
  /// same node until at least the given `depth`, since a node range
  /// denotes an adjacent set of nodes in a single parent node.
  constructor(
    /// A resolved position along the start of the content. May have a
    /// `depth` greater than this object's `depth` property, since
    /// these are the positions that were used to compute the range,
    /// not re-resolved positions directly at its boundaries.
    readonly $from: ResolvedPos,
    /// A position along the end of the content. See
    /// caveat for [`$from`](#model.NodeRange.$from).
    readonly $to: ResolvedPos,
    /// The depth of the node that this range points into.
    readonly depth: number,
  ) {}

  /** The position at the start of the range. */
  get start() {
    return this.$from.before(this.depth + 1);
  }
  /** The position at the end of the range. */
  get end() {
    return this.$to.after(this.depth + 1);
  }

  /** The parent node that the range points into. */
  get parent() {
    return this.$from.node(this.depth);
  }
  /** The start index of the range in the parent node. */
  get startIndex() {
    return this.$from.index(this.depth);
  }
  /** The end index of the range in the parent node. */
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
}
