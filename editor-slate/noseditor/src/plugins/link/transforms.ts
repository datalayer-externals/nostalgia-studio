import { Editor, Transforms } from 'slate';

import { createLinkElement, isLinkElement } from '../link/utils';

export const insertLink = (editor: Editor, url: string) => {
  Transforms.insertNodes(editor, createLinkElement({ url, text: url }));
  // move selection offset to continue editing text instead a link
  Transforms.move(editor, { unit: 'offset' });
};

export const unwarpLinks = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: isLinkElement,
  });
};
