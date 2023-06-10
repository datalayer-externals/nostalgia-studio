import { type InsertNodeOperation, type Node, Text } from 'slate';
import type * as Y from 'yjs';
import { slateElementToYText } from '../../utils/convert';
import { getYTarget } from '../../utils/location';
import { getProperties } from '../../utils/slate';

export function insertNode(
  sharedRoot: Y.XmlText,
  slateRoot: Node,
  op: InsertNodeOperation,
): void {
  const { yParent, textRange } = getYTarget(sharedRoot, slateRoot, op.path);

  if (Text.isText(op.node)) {
    return yParent.insert(
      textRange.start,
      op.node.text,
      getProperties(op.node),
    );
  }

  yParent.insertEmbed(textRange.start, slateElementToYText(op.node));
}
