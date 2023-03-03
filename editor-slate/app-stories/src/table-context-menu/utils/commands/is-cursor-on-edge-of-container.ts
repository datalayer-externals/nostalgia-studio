import type { Point, Range } from 'slate';
import { Editor } from 'slate';
import { ReactEditor } from 'slate-react';

import { CustomEditor } from '../../customTypes';

export type ContainerEdge = 'top' | 'bottom';

export function isCursorOnFirstLine(editor: CustomEditor, container: Point, cursor: Point): boolean {
  return isCursorOnEdgeOfContainer(editor, container, cursor, 'top');
}

export function isCursorOnLastLine(editor: CustomEditor, container: Point, cursor: Point): boolean {
  return isCursorOnEdgeOfContainer(editor, container, cursor, 'bottom');
}

export function isCursorOnEdgeOfContainer(
  editor: CustomEditor,
  container: Point,
  cursor: Point,
  edge: ContainerEdge,
) {
  const a = getPointRect(editor, container);
  const b = getPointRect(editor, cursor);

  if (!a || !b) {
    return false;
  }

  switch (edge) {
    case 'top':
      return a.at(0)?.top === b.at(0)?.top;
    case 'bottom':
      return a.at(-1)?.bottom === b.at(-1)?.bottom;
  }
}

function getPointRect(editor: CustomEditor, point: Point) {

  const range = Editor.range(editor, { ...point, offset: Math.max(point.offset, 0) });
  try {
    return getRangeRect(editor, range);
  } catch {
    return undefined;
  }
}

/**
 * getBoundingClientRect
 */
function getRangeRect(editor: CustomEditor, range: Range) {
  const domRange = ReactEditor.toDOMRange(editor, range);
  const rects = domRange.getClientRects();

  // if the cursor will be in the beginning of next line there will be two rects:
  // first the ending of previous line and the second one is the beginning of current line
  if (rects.length) {
    return Array.from(rects);
  }

  return [domRange.getBoundingClientRect()];
}
