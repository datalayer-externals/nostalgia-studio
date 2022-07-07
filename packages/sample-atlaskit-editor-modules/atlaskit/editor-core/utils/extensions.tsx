import React from 'react';
import Loadable from 'react-loadable';

import {
  ExtensionProvider,
  MenuItem,
  combineProviders,
  getQuickInsertItemsFromModule,
  resolveImport,
} from '../../editor-common';
import {
  QuickInsertItem,
  QuickInsertProvider,
} from '../../editor-common/provider-factory';
import EditorActions from '../actions';
import { fireAnalyticsEvent } from '../plugins/analytics';
import {
  ACTION,
  ACTION_SUBJECT,
  ACTION_SUBJECT_ID,
  EVENT_TYPE,
  INPUT_METHOD,
} from '../plugins/analytics/types/enums';

// import { CreateUIAnalyticsEvent } from '@atlaskit/analytics-next/types';

type CreateUIAnalyticsEvent = any;
/**
 * Utils to send analytics event when a extension is inserted using quickInsert
 */
function sendExtensionQuickInsertAnalytics(
  item: MenuItem,
  createAnalyticsEvent?: CreateUIAnalyticsEvent,
) {
  if (createAnalyticsEvent) {
    fireAnalyticsEvent(createAnalyticsEvent)({
      payload: {
        action: ACTION.INSERTED,
        actionSubject: ACTION_SUBJECT.DOCUMENT,
        actionSubjectId: ACTION_SUBJECT_ID.EXTENSION,
        attributes: {
          extensionType: item.extensionType,
          key: item.key,
          inputMethod: INPUT_METHOD.QUICK_INSERT,
        },
        eventType: EVENT_TYPE.TRACK,
      },
    });
  }
}

export async function extensionProviderToQuickInsertProvider(
  extensionProvider: ExtensionProvider,
  editorActions: EditorActions,
  createAnalyticsEvent?: CreateUIAnalyticsEvent,
): Promise<QuickInsertProvider> {
  const extensions = await extensionProvider.getExtensions();

  return {
    getItems: () => {
      const quickInsertItems = getQuickInsertItemsFromModule<QuickInsertItem>(
        extensions,
        (item) => {
          const Icon = Loadable<{ label: string }, any>({
            loader: item.icon,
            loading: () => null,
          });

          return {
            title: item.title,
            description: item.description,
            icon: () => <Icon label='' />,
            keywords: item.keywords,
            featured: item.featured,
            categories: item.categories,
            action: (insert) => {
              if (typeof item.node === 'function') {
                resolveImport(item.node()).then((node) => {
                  sendExtensionQuickInsertAnalytics(item, createAnalyticsEvent);

                  if (node) {
                    editorActions.replaceSelection(node);
                  }
                });

                return insert('');
              } else {
                sendExtensionQuickInsertAnalytics(item, createAnalyticsEvent);
                return insert(item.node);
              }
            },
          };
        },
      );

      return Promise.all(quickInsertItems);
    },
  };
}

export async function combineQuickInsertProviders(
  quickInsertProviders: Array<
    QuickInsertProvider | Promise<QuickInsertProvider>
  >,
): Promise<QuickInsertProvider> {
  const { invokeList } =
    combineProviders<QuickInsertProvider>(quickInsertProviders);

  return {
    getItems() {
      return invokeList('getItems');
    },
  };
}