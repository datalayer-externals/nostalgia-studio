import { Editor, Element, Path, Range, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';

import { NestingElement } from '../../slate-extended/types';
import { isParagraphElement } from '../paragraph/utils';
import { ListItemType, ListTypes } from './types';
import { isListItemElement } from './utils';

export const moveItemsForward = (
  editor: Editor,
  node: NestingElement,
  path: Path,
  maxDepth: number,
) => {
  Transforms.setNodes(
    editor,
    { depth: Math.min(maxDepth, node.depth + 1) },
    { at: path },
  );
};

export const moveItemsBack = (
  editor: Editor,
  node: NestingElement,
  path: Path,
) => {
  Transforms.setNodes(
    editor,
    { depth: Math.max(0, node.depth - 1) },
    { at: path },
  );
};

export const checkTodoItem = (
  editor: Editor,
  element: Element,
  checked: boolean,
) => {
  const path = ReactEditor.findPath(editor, element);

  Transforms.setNodes(
    editor,
    { checked },
    { match: (node) => node === element, at: path },
  );
};

export const toggleList = (
  editor: Editor,
  { listType }: { listType: ListTypes },
) => {
  Editor.withoutNormalizing(editor, () => {
    const { selection } = editor;

    if (!selection) {
      return;
    }

    Transforms.setNodes(
      editor,
      { type: ListItemType, listType },
      {
        match: isListItemElement,
      },
    );

    Transforms.setNodes(
      editor,
      { type: ListItemType, depth: 0, listType },
      {
        match: (node, path) =>
          Range.isExpanded(selection)
            ? isParagraphElement(node)
            : !isListItemElement(node) && path.length === 1,
      },
    );
  });
};
