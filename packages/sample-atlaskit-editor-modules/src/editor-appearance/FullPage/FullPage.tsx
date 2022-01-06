import { EditorView } from 'prosemirror-view';
import React, { useRef } from 'react';
import styled from 'styled-components';

import { EditorActions } from '../../EditorActions';
import { ProviderFactory } from '../../provider-factory';
import {
  EditorAppearance,
  ToolbarUIComponentFactory,
  UIComponentFactory,
} from '../../types';
import { EventDispatcher } from '../../utils/event-dispatcher';
import PluginSlot from '../PluginSlot';
import { Toolbar } from './Toolbar';

interface IProps {
  className?: string;
  appearance?: EditorAppearance;
  editorActions?: EditorActions;
  editorDOMElement: JSX.Element;
  editorView?: EditorView;
  providerFactory: ProviderFactory;
  eventDispatcher?: EventDispatcher;
  contentComponents?: UIComponentFactory[];
  primaryToolbarComponents?: ToolbarUIComponentFactory[];
}

/** 指定了Editor组件的结构布局 */
export function FullPage(props: IProps) {
  const { className, editorDOMElement } = props;
  const popupsRef = useRef(null);
  const contentAreaRef = useRef(null);

  return (
    <Container className={`${className} popups-wrapper`}>
      <Popups className='popups' ref={popupsRef} />
      <Toolbar />
      <ContentArea ref={contentAreaRef}>
        <PluginSlot
          editorView={props.editorView}
          editorActions={props.editorActions}
          eventDispatcher={props.eventDispatcher}
          providerFactory={props.providerFactory}
          appearance={props.appearance}
          items={props.contentComponents}
          contentAreaRef={contentAreaRef.current}
          popupsMountPoint={popupsRef.current}
          // popupsBoundariesElement={props.popupsBoundariesElement}
          // popupsScrollableElement={props.popupsScrollableElement}
          disabled={false}
          containerElement={null}
        />
        {
          // 这里渲染核心的editor组件
          editorDOMElement
        }
      </ContentArea>
    </Container>
  );
}

const Container = styled.div`
  position: relative;
`;
const Popups = styled.div`
  z-index: 9999;
`;
const ContentArea = styled.div`
  border: 1px solid black;
  & > .ProseMirror {
    min-height: 140px;
    overflow-wrap: break-word;
    outline: none;
    padding: 10px;
    white-space: pre-wrap;
  }
`;
