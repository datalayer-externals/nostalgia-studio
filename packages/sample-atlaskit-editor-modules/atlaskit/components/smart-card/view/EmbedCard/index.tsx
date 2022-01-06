import { JsonLd } from 'json-ld-types';
import * as React from 'react';

import {
  BlockCardResolvedView,
  BlockCardResolvingView,
  InlineCardResolvedView,
} from '../../../media-ui';
import {
  EmbedCardErroredView,
  EmbedCardForbiddenView,
  EmbedCardNotFoundView,
  EmbedCardResolvedView,
  EmbedCardUnauthorisedView,
} from '../../../media-ui/embeds';
import { extractBlockProps } from '../../extractors/block';
import { extractRequestAccessContext } from '../../extractors/common/context';
import { extractEmbedProps } from '../../extractors/embed';
import { extractInlineProps } from '../../extractors/inline';
import { getDefinitionId } from '../../state/helpers';
import { getEmptyJsonLd, getUnauthorizedJsonLd } from '../../utils/jsonld';
import { EmbedCardProps } from './types';

export const EmbedCard = React.forwardRef<HTMLIFrameElement, EmbedCardProps>(
  (
    {
      url,
      cardState: { status, details },
      handleAuthorize,
      handleErrorRetry,
      handleFrameClick,
      handleAnalytics,
      handleInvoke,
      showActions,
      isSelected,
      isFrameVisible,
      platform,
      onResolve,
      testId,
      inheritDimensions,
    },
    iframeRef,
  ) => {
    const data =
      ((details && details.data) as JsonLd.Data.BaseData) || getEmptyJsonLd();
    switch (status) {
      case 'pending':
      case 'resolving':
        return (
          <BlockCardResolvingView
            testId='embed-card-resolving-view'
            inheritDimensions={inheritDimensions}
            isSelected={isSelected}
          />
        );
      case 'resolved': {
        const resolvedViewProps = extractEmbedProps(data, platform);
        if (onResolve) {
          onResolve({
            title: resolvedViewProps.title,
            url,
            aspectRatio: resolvedViewProps.preview?.aspectRatio,
          });
        }
        if (resolvedViewProps.preview) {
          return (
            <EmbedCardResolvedView
              {...resolvedViewProps}
              isSelected={isSelected}
              isFrameVisible={isFrameVisible}
              inheritDimensions={inheritDimensions}
              onClick={handleFrameClick}
              ref={iframeRef}
            />
          );
        } else {
          if (platform === 'mobile') {
            const resolvedInlineViewProps = extractInlineProps(data);
            return (
              <InlineCardResolvedView
                {...resolvedInlineViewProps}
                isSelected={isSelected}
                testId={testId}
                onClick={handleFrameClick}
              />
            );
          }
          const resolvedBlockViewProps = extractBlockProps(data, {
            handleAnalytics,
            handleInvoke,
            definitionId: getDefinitionId(details),
          });
          return (
            <BlockCardResolvedView
              {...resolvedBlockViewProps}
              isSelected={isSelected}
              testId={testId}
              showActions={showActions}
              onClick={handleFrameClick}
            />
          );
        }
      }
      case 'unauthorized': {
        const unauthorisedViewProps = extractEmbedProps(data, platform);
        return (
          <EmbedCardUnauthorisedView
            {...unauthorisedViewProps}
            isSelected={isSelected}
            onAuthorise={handleAuthorize}
            inheritDimensions={inheritDimensions}
            onClick={handleFrameClick}
          />
        );
      }
      case 'forbidden': {
        const forbiddenViewProps = extractEmbedProps(data, platform);
        const cardMetadata = details?.meta ?? getUnauthorizedJsonLd().meta;
        const requestAccessContext = extractRequestAccessContext({
          jsonLd: cardMetadata,
          url,
          context: forbiddenViewProps.context?.text,
        });
        return (
          <EmbedCardForbiddenView
            {...forbiddenViewProps}
            isSelected={isSelected}
            onAuthorise={handleAuthorize}
            inheritDimensions={inheritDimensions}
            onClick={handleFrameClick}
            requestAccessContext={requestAccessContext}
          />
        );
      }
      case 'not_found': {
        const notFoundViewProps = extractEmbedProps(data, platform);
        return (
          <EmbedCardNotFoundView
            {...notFoundViewProps}
            isSelected={isSelected}
            inheritDimensions={inheritDimensions}
            onClick={handleFrameClick}
          />
        );
      }
      case 'fallback':
      case 'errored':
        return (
          <EmbedCardErroredView
            onRetry={handleErrorRetry}
            inheritDimensions={inheritDimensions}
            isSelected={isSelected}
          />
        );
    }
  },
);
