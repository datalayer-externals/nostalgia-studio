import React, { FC } from 'react';

import { CardLinkView } from '../../../../media-ui';
import { CardWithUrlContentProps } from '../types';

export const LoadingCardLink: FC<CardWithUrlContentProps> = ({
  isSelected,
  url,
}) => (
  <CardLinkView
    key='lazy-render-key'
    testId='lazy-render-placeholder'
    data-trello-do-not-use-override='lazy-render-placeholder-trello'
    isSelected={isSelected}
    link={url}
  />
);
