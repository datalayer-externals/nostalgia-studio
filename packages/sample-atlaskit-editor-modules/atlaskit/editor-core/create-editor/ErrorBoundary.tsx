import memoizeOne from 'memoize-one';
import { EditorView } from 'prosemirror-view';
import React from 'react';
import uuid from 'uuid';

import type { ContextIdentifierProvider } from '../../editor-common';
import {
  ACTION,
  ACTION_SUBJECT,
  EVENT_TYPE,
  ErrorEventPayload,
} from '../plugins/analytics';
import { editorAnalyticsChannel } from '../plugins/analytics/consts';
import { getFeatureFlags } from '../plugins/feature-flags-context';
import type { FeatureFlags } from '../types/feature-flags';
import { getDocStructure } from '../utils/document-logger';
import { WithEditorView } from './WithEditorView';

// import { CreateUIAnalyticsEvent } from '@atlaskit/analytics-next';

type CreateUIAnalyticsEvent = any;

export type ErrorBoundaryProps = {
  createAnalyticsEvent?: CreateUIAnalyticsEvent;
  contextIdentifierProvider?: Promise<ContextIdentifierProvider>;
  editorView?: EditorView;
  rethrow?: boolean;
  children: React.ReactNode;
};

export type ErrorBoundaryState = {
  error?: Error;
};

type AnalyticsErrorBoundaryErrorInfo = {
  componentStack: string;
};

type AnalyticsErrorBoundaryAttributes = {
  error: string;
  info?: AnalyticsErrorBoundaryErrorInfo;
  [key: string]: any;
};

export class ErrorBoundaryWithEditorView extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static defaultProps = {
    rethrow: true,
  };

  state = {
    error: undefined,
  };

  componentDidCatch(error: Error, errorInfo: AnalyticsErrorBoundaryErrorInfo) {
    // Log the error
    this.fireAnalytics({
      error: error.toString(),
      errorInfo,
      errorStack: error.stack,
    });
    //
    // Update state to allow a re-render to attempt graceful recovery (in the event that
    // the error was caused by a race condition or is intermittent)
    this.setState({ error }, () => {
      if (this.props.rethrow) {
        // Now that a re-render has occurred, we re-throw to allow product error boundaries
        // to catch and handle the error too.
        //
        // Note that when rethrowing inside a error boundary, the stack trace
        // from a higher error boundary's componentDidCatch.info param will reset
        // to this component, instead of the original component which threw it.
        throw error;
      }
    });
  }

  // Memoizing this as react alternative suggestion of https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops
  private getFeatureFlags = memoizeOne(
    (editorView: EditorView | undefined): FeatureFlags => {
      if (!editorView) {
        return {};
      }
      return getFeatureFlags(editorView.state);
    },
  );

  get featureFlags() {
    return this.getFeatureFlags(this.props.editorView);
  }

  fireAnalytics = (analyticsErrorPayload: AnalyticsErrorBoundaryAttributes) => {
    const { createAnalyticsEvent } = this.props;
    this.getProductName()
      .then((product) => {
        if (createAnalyticsEvent) {
          const { error, errorInfo, errorStack } = analyticsErrorPayload;
          const sharedId = uuid();
          const event: ErrorEventPayload = {
            action: ACTION.EDITOR_CRASHED,
            actionSubject: ACTION_SUBJECT.EDITOR,
            eventType: EVENT_TYPE.OPERATIONAL,
            attributes: {
              product,
              browserInfo:
                window && window.navigator && window.navigator.userAgent
                  ? window.navigator.userAgent
                  : 'unknown',
              error: error as any as Error,
              errorInfo,
              errorId: sharedId,
            },
          };

          // Add doc structure if the feature flag is on
          if (
            this.featureFlags.errorBoundaryDocStructure &&
            this.props.editorView
          ) {
            event.attributes!.docStructure = getDocStructure(
              this.props.editorView.state.doc,
              { compact: true },
            );
          }
          createAnalyticsEvent(event).fire(editorAnalyticsChannel);
          createAnalyticsEvent({
            action: ACTION.EDITOR_CRASHED_ADDITIONAL_INFORMATION,
            actionSubject: ACTION_SUBJECT.EDITOR,
            eventType: EVENT_TYPE.OPERATIONAL,
            attributes: {
              errorStack,
              errorId: sharedId,
            },
          }).fire(editorAnalyticsChannel);
        } else {
          console.error(
            'Editor Error Boundary: Missing `createAnalyticsEvent` prop.',
            {
              channel: editorAnalyticsChannel,
              product,
              error: analyticsErrorPayload,
            },
          );
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(
          'Failed to resolve product name from contextIdentifierProvider.',
          e,
        );
      });
  };

  private getProductName = async () => {
    const { contextIdentifierProvider } = this.props;
    if (contextIdentifierProvider) {
      const context = await contextIdentifierProvider;
      if (context.product) {
        return context.product;
      }
    }
    return 'atlaskit';
  };

  render() {
    return this.props.children;
  }
}

export default WithEditorView(ErrorBoundaryWithEditorView);
