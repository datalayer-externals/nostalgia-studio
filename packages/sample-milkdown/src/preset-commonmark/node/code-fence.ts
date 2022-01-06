import {
  CompleteContext,
  LoadState,
  NodeParserSpec,
  NodeSerializerSpec,
} from '../../core';
import { setBlockType } from 'prosemirror-commands';
import { textblockTypeInputRule } from 'prosemirror-inputrules';
import type { DOMOutputSpec, NodeSpec, NodeType } from 'prosemirror-model';
import { SupportedKeys } from '../supported-keys';
import { BaseNode } from '../utility';

const languageOptions = [
  '',
  'javascript',
  'typescript',
  'bash',
  'sql',
  'json',
  'html',
  'css',
  'c',
  'cpp',
  'java',
  'ruby',
  'python',
  'go',
  'rust',
  'markdown',
];

type CodeFenceOptions = {
  languageList?: string[];
};

type Keys = SupportedKeys.CodeFence;

export class CodeFence extends BaseNode<Keys, CodeFenceOptions> {
  override readonly id = 'fence';
  override readonly schema: NodeSpec = {
    content: 'text*',
    group: 'block',
    marks: '',
    defining: true,
    code: true,
    attrs: {
      language: {
        default: '',
      },
    },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            throw new Error();
          }
          return { language: dom.dataset.language };
        },
      },
    ],
    toDOM: (node) => {
      const select = this.#createSelectElement(node.attrs.language) as unknown;
      const className = this.getClassName(node.attrs, 'code-fence');
      return [
        'div',
        {
          'data-language': '',
          class: className,
        },
        ['div', { contentEditable: 'false' }, select as DOMOutputSpec],
        ['pre', ['code', { spellCheck: 'false' }, 0]],
      ];
    },
  };
  override readonly parser: NodeParserSpec = {
    match: ({ type }) => type === 'code',
    runner: (state, node, type) => {
      const lang = node.lang as string;
      const value = node.value as string;
      state.openNode(type, { language: lang });
      state.addText(value);
      state.closeNode();
    },
  };
  override readonly serializer: NodeSerializerSpec = {
    match: (node) => node.type.name === this.id,
    runner: (state, node) => {
      state.addNode('code', undefined, node.content.firstChild?.text || '', {
        lang: node.attrs.language,
      });
    },
  };

  override readonly inputRules = (nodeType: NodeType) => [
    textblockTypeInputRule(/^```$/, nodeType),
  ];

  // override readonly keymap = (nodeType: NodeType): Keymap => ({
  //     Tab: (state: EditorState, dispatch) => {
  //         const { tr, selection } = state;
  //         if (!dispatch) {
  //             return false;
  //         }
  //         dispatch(tr.insertText('  ', selection.from, selection.to));
  //         return true;
  //     },
  //     'Mod-Alt-c': setBlockType(nodeType),
  // });

  override readonly commands: BaseNode<Keys>['commands'] = (
    nodeType: NodeType,
  ) => ({
    [SupportedKeys.CodeFence]: {
      defaultKey: 'Mod-Alt-c',
      command: setBlockType(nodeType),
    },
  });

  #onChangeLanguage(top: number, left: number, language: string) {
    const { editorView } = this.context as CompleteContext;
    const result = editorView.posAtCoords({ top, left });

    if (!result) {
      return;
    }
    const transaction = editorView.state.tr.setNodeMarkup(
      result.inside,
      void 0,
      {
        language,
      },
    );
    editorView.dispatch(transaction);
  }

  #createSelectElement(currentLanguage: string) {
    const select = document.createElement('select');
    select.className = 'code-fence_select';
    select.addEventListener('mousedown', (e) => {
      const { editorView } = this.context as CompleteContext;
      if (editorView.editable) return;

      e.preventDefault();
    });
    select.addEventListener('change', (e) => {
      if (this.context.loadState !== LoadState.Complete) {
        throw new Error('Should not trigger event before milkdown ready.');
      }

      const el = e.target as HTMLSelectElement | null;
      if (!el) return;
      const { top, left } = el.getBoundingClientRect();
      this.#onChangeLanguage(top, left, el.value);
    });

    languageOptions.concat(this.options.languageList || []).forEach((lang) => {
      const option = document.createElement('option');
      option.className = 'code-fence_select-option';
      option.value = lang;
      option.innerText = lang || '--';
      option.selected = currentLanguage === lang;
      select.appendChild(option);
    });
    return select;
  }
}
