import { indexBy } from 'ramda';
import { Editor } from 'slate';

import { deserializeHtml } from '@udecode/plate-core';

import { deserializePlugins } from './deserialize-plugins';
import { patchPastedClipboardHtml } from './patch-pasted-clipboard-html';

export const withDeserialize = (editor: Editor) => {
  const { insertFragmentData } = editor;

  editor.insertFragmentData = (data) => {
    const result = insertFragmentData(data);

    if (result) {
      return true;
    }

    let html = data.getData('text/html');

    if (!html) {
      return false;
    }

    html = html.replace(new RegExp(String.fromCharCode(160), 'g'), ' '); // replace whitespaces 160 to 32, they could be at links edges

    const document = new DOMParser().parseFromString(html, 'text/html');

    patchPastedClipboardHtml(document.body);

    const htmlFragment = deserializeHtml(
      {
        ...editor,
        plugins: deserializePlugins,
        pluginsByKey: indexBy((x) => x.key, deserializePlugins),
      },
      { element: document.body },
    );

    if (htmlFragment) {
      editor.insertFragment(htmlFragment);
      return true;
    }

    return false;
  };

  return editor;
};
