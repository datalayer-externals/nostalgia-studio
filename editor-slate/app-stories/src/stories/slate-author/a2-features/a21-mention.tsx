import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Descendant, Editor, Range, Transforms, createEditor } from 'slate';
import { withHistory } from 'slate-history';
import {
  Editable,
  ReactEditor,
  Slate,
  useFocused,
  useSelected,
  withReact,
} from 'slate-react';

import { Portal } from '../components';
import { MentionElement } from '../types';
import { MENTION_CHARACTERS } from '../utils';

/** mention plugin */
const withMentions = (editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    return element.type === 'mention' ? true : isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === 'mention' ? true : isVoid(element);
  };

  return editor;
};

/** mention  */
const insertMention = (editor, character) => {
  const mention: MentionElement = {
    type: 'mention',
    character,
    children: [{ text: '' }],
  };
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor);
};

const Element = (props) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case 'mention':
      return <Mention {...props} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

export const MentionApp = () => {
  const ref = useRef<HTMLDivElement | null>();
  const [target, setTarget] = useState<Range | undefined>();
  // mention下拉列表中选中的索引号
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState('');

  const renderElement = useCallback((props) => <Element {...props} />, []);
  const editor = useMemo(
    () => withMentions(withReact(withHistory(createEditor()))),
    [],
  );

  const chars = MENTION_CHARACTERS.filter((c) =>
    c.toLowerCase().startsWith(search.toLowerCase()),
  ).slice(0, 10);

  const onKeyDown = useCallback(
    (event) => {
      if (target) {
        switch (event.key) {
          case 'ArrowDown': {
            event.preventDefault();
            const prevIndex = selectedIndex >= chars.length - 1 ? 0 : selectedIndex + 1;
            setSelectedIndex(prevIndex);
            break;
          }
          case 'ArrowUp': {
            event.preventDefault();
            const nextIndex = selectedIndex <= 0 ? chars.length - 1 : selectedIndex - 1;
            setSelectedIndex(nextIndex);
            break;
          }
          case 'Tab':
          case 'Enter':
            event.preventDefault();
            Transforms.select(editor, target);
            // 👉 在enter键处理插入inline元素
            insertMention(editor, chars[selectedIndex]);
            setTarget(null);
            break;
          case 'Escape':
            event.preventDefault();
            setTarget(null);
            break;
        }
      }
    },
    [chars, editor, selectedIndex, target],
  );

  useEffect(() => {
    if (target && chars.length > 0) {
      const el = ref.current;
      const domRange = ReactEditor.toDOMRange(editor, target);
      const rect = domRange.getBoundingClientRect();
      el.style.top = `${rect.top + window.pageYOffset + 24}px`;
      el.style.left = `${rect.left + window.pageXOffset}px`;
    }
  }, [chars.length, editor, selectedIndex, search, target]);

  return (
    <Slate
      editor={editor}
      value={initialValue}
      onChange={() => {
        const { selection } = editor;

        if (selection && Range.isCollapsed(selection)) {
          const [start] = Range.edges(selection);
          const wordBefore = Editor.before(editor, start, { unit: 'word' });
          const before = wordBefore && Editor.before(editor, wordBefore);
          const beforeRange = before && Editor.range(editor, before, start);
          const beforeText = beforeRange && Editor.string(editor, beforeRange);
          const beforeMatch = beforeText && beforeText.match(/^@(\w+)$/);
          const after = Editor.after(editor, start);
          const afterRange = Editor.range(editor, start, after);
          const afterText = Editor.string(editor, afterRange);
          const afterMatch = afterText.match(/^(\s|$)/);

          if (beforeMatch && afterMatch) {
            setTarget(beforeRange);
            setSearch(beforeMatch[1]);
            setSelectedIndex(0);
            return;
          }
        }

        setTarget(null);
      }}
    >
      <Editable
        renderElement={renderElement}
        onKeyDown={onKeyDown}
        placeholder='Enter some text...'
      />
      {target && chars.length > 0 && (
        <Portal>
          <div
            ref={ref}
            style={{
              top: '-9999px',
              left: '-9999px',
              position: 'absolute',
              zIndex: 1,
              padding: '3px',
              background: 'white',
              borderRadius: '4px',
              boxShadow: '0 1px 5px rgba(0,0,0,.2)',
            }}
            data-cy='mentions-portal'
          >
            {chars.map((char, i) => (
              <div
                key={char}
                style={{
                  padding: '1px 3px',
                  borderRadius: '3px',
                  background: i === selectedIndex ? '#B4D5FF' : 'transparent',
                }}
              >
                {char}
              </div>
            ))}
          </div>
        </Portal>
      )}
    </Slate>
  );
};

const Mention = ({ attributes, children, element }) => {
  const selected = useSelected();
  const focused = useFocused();

  return (
    <span
      {...attributes}
      contentEditable={false}
      data-cy={`mention-${element.character.replace(' ', '-')}`}
      style={{
        padding: '3px 3px 2px',
        margin: '0 1px',
        verticalAlign: 'baseline',
        display: 'inline-block',
        borderRadius: '4px',
        backgroundColor: '#eee',
        fontSize: '0.9em',
        boxShadow: selected && focused ? '0 0 0 2px #B4D5FF' : 'none',
      }}
    >
      @{element.character}
      {children}
    </span>
  );
};

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [
      {
        text: 'This example shows how you might implement a simple @-mentions feature that lets users autocomplete mentioning a user by their username. Which, in this case means Star Wars characters. The mentions are rendered as void inline elements inside the document.',
      },
    ],
  },
  {
    type: 'paragraph',
    children: [
      { text: 'Try mentioning characters, like ' },
      {
        type: 'mention',
        character: 'R2-D2',
        children: [{ text: '' }],
      },
      { text: ' or ' },
      {
        type: 'mention',
        character: 'Mace Windu',
        children: [{ text: '' }],
      },
      { text: '!' },
    ],
  },
];
