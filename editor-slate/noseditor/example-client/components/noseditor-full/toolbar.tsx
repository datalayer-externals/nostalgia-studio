import React, {
  ChangeEvent,
  Fragment,
  MouseEvent,
  useEffect,
  useState,
} from 'react';

import { type Editor } from 'slate';
import { useSlate } from 'slate-react';

import { css } from '@linaria/core';

import { IconButton } from '../../../src';
import {
  Heading1Spec,
  Heading2Spec,
  Heading3Spec,
} from '../../../src/plugins/heading/utils';
import {
  isListBlockActive,
  toggleList,
} from '../../../src/plugins/list/commands';
import { ListTypes } from '../../../src/plugins/list/utils';
import type { TextFormats } from '../../../src/plugins/marks/types';
import { ParagraphSpec } from '../../../src/plugins/paragraph/utils';
import { themed } from '../../../src/styles';
import {
  addMarkData,
  getActiveBlockType,
  isBlockActive,
  isMarkActive,
  toggleBlock,
  toggleMark,
  toggleTextAlign,
} from '../../../src/transforms';
import { AddLinkPanel } from './add-link-panel';
import { ColorPicker } from './color-picker';
import { ToolbarBtnActiveClassName, ToolbarButton } from './toolbar-button';
import { defaultToolbarConfig, TextAlignValueType } from './toolbar-config';

const toggleTextFormatHandler =
  (editor: Editor, format: TextFormats) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      toggleMark(editor, format);
    };

const toggleTextAlignHandler =
  (editor: Editor, align?: TextAlignValueType) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      event.preventDefault();
      toggleTextAlign(editor, event.target.value as TextAlignValueType);
      // console.log(';; txt-align ', event.target.value)
    };

/** used to add fontSize, also support other formats */
const addTextFormatHandler =
  (editor: Editor, format: TextFormats, value = true) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      event.preventDefault();
      addMarkData(editor, { format, value: event.target.value });
    };

const checkIsMenuItemListType = (
  action: string,
): action is (typeof ListTypes)[keyof typeof ListTypes] =>
  Object.values(ListTypes).find((item) => item === action) !== undefined;

const toggleListTypesHandler =
  (editor: Editor, list: (typeof ListTypes)[keyof typeof ListTypes]) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      toggleList(editor, { listType: list });
    };

const toggleBlockTypesHandler =
  (editor: Editor) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      event.preventDefault();
      toggleBlock(editor, event.target.value as any);
    };


const useShowAddLinkPanel = ({ initialShow = false } = {}) => {
  const [showAddLink, setShowAddLink] = useState(initialShow);
  return { showAddLink, setShowAddLink };
};

const useToolbarGroupsConfig = (initialConfig = defaultToolbarConfig) => {
  const [toolbarGroups, setToolbarGroups] = useState(initialConfig);
  return { toolbarGroups, setToolbarGroups };
};

export const NosToolbar = () => {
  const editor = useSlate();
  const { showAddLink, setShowAddLink } = useShowAddLinkPanel();
  const { toolbarGroups, setToolbarGroups } = useToolbarGroupsConfig();

  return (
    <div className='nosedit-toolbar'>
      {toolbarGroups.map((group, groupIndex) => {
        const groupItemsElem = group.map((item, index2) => {
          const { type, icon: Icon, title } = item;
          if (type === 'button') {
            const { format, action } = item;

            if (checkIsMenuItemListType(action)) {
              return (
                <ToolbarButton
                  onMouseDown={toggleListTypesHandler(editor, action)}
                  className={
                    isListBlockActive(editor, action)
                      ? ToolbarBtnActiveClassName
                      : ''
                  }
                  key={title}
                  title={title}
                >
                  <Icon />
                </ToolbarButton>
              );
            }
            if (action === 'link') {
              return (
                <ToolbarButton
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddLink(true);
                  }}
                  className={
                    isBlockActive(editor, action)
                      ? ToolbarBtnActiveClassName
                      : ''
                  }
                  key={title}
                  title={title}
                >
                  <Icon />
                </ToolbarButton>
              );
            }

            if (action === 'colorPicker') {
              const format = item.format as 'color' | 'bgColor';
              return (
                <ColorPicker
                  editor={editor}
                  format={format}
                  icon={Icon}
                  key={title}
                  title={title}
                />
              );
            }

            if (format) {
              // /for bold/italic/underline
              return (
                <ToolbarButton
                  onMouseDown={toggleTextFormatHandler(editor, format)}
                  className={
                    isMarkActive(editor, format)
                      ? ToolbarBtnActiveClassName
                      : ''
                  }
                  key={title}
                  title={title}
                >
                  <Icon />
                </ToolbarButton>
              );
            }

            // /more buttons actions
            return (
              <IconButton
                // onClick={(e) => {
                //   e.preventDefault();
                //   e.stopPropagation();
                //   setShowAddLink(true);
                // }}
                key={title}
                title={title}
              >
                <Icon />
              </IconButton>
            );
          }
          if (type === 'dropdown') {
            const { options, action } = item;
            if (action === 'align') {
              return (
                <ToolbarDropdown
                  editor={editor}
                  action={action}
                  options={options}
                  value='alignLeft'
                  onChange={toggleTextAlignHandler(editor)}
                  key={index2}
                />
              );
            }

            if (action === 'fontSize') {
              return (
                <ToolbarDropdown
                  editor={editor}
                  action={action}
                  options={options}
                  value={'16px'}
                  onChange={addTextFormatHandler(editor, action)}
                  key={index2}
                />
              );
            }

            if (action === 'blockTypes') {
              return (
                <ToolbarDropdown
                  editor={editor}
                  action={action}
                  options={options}
                  value={getActiveBlockType(editor)}
                  onChange={toggleBlockTypesHandler(editor)}
                  key={index2}
                />
              );
            }

            // /more dropdown actions
            return (
              <ToolbarDropdown
                editor={editor}
                action={action}
                options={options}
                value=''
                // onChange={addTextFormatHandler(editor, action)}
                onChange={() => { }}
                key={index2}
              />
            );
          }

          return null;
        });

        return groupIndex === toolbarGroups.length - 1 ? (
          <Fragment key={groupIndex}>{groupItemsElem}</Fragment>
        ) : (
          <Fragment key={groupIndex}>
            {groupItemsElem}
            <div className={toolbarSeparatorCss}> </div>
          </Fragment>
        );
      })}
      {showAddLink ? (
        <AddLinkPanel
          showAddLink={showAddLink}
          setShowAddLink={setShowAddLink}
        />
      ) : null}
    </div>
  );
};

const ToolbarDropdown = ({ editor, action, options, value, onChange }) => {
  return (
    <select
      // value={activeMark(editor, format)}
      value={value ?? 'bb'}
      onChange={onChange}
      className={dropdownCss}
    >
      {options.map(({ value, icon: Icon, title, text }) => (
        <option key={value} value={value} title={title}>
          {text}
          {/* <IconButton title={title}>
            <Icon title={title} />
          </IconButton> */}
        </option>
      ))}
    </select>
  );
};

const dropdownCss = css`
  min-width: 48px;
  border: none;
  border-radius: ${themed.size.borderRadius.sm};
  background-color: ${themed.palette.white};
  color: ${themed.color.text.muted};
  cursor: pointer;
  &:hover {
    background-color: ${themed.color.background.hover};
  }
  &:focus-visible {
    outline-width: 0px;
  }

  & option {
    border: none;
  }
`;

const toolbarSeparatorCss = css`
  min-height: 20px;
  margin-left: ${themed.spacing.spacerS};
  margin-right: ${themed.spacing.spacerS};
  border-left: 1px solid ${themed.color.border.light};
  user-select: none;
`;
