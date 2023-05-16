import React from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import type { CardProps } from '.';

export function SubCard(
  {
    children,
    content,
    contentClass,
    darkTitle,
    secondary,
    sx = {},
    contentSX = {},
    title,
    ...others
  }: CardProps,
  ref?: React.MutableRefObject<HTMLDivElement>,
) {
  const theme = useTheme();

  return (
    <Card
      ref={ref}
      sx={{
        border: '1px solid',
        borderColor: theme.palette.primary.light,
        ':hover': {
          boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)',
        },
        ...sx,
      }}
      {...others}
    >
      {/* card header and action */}
      {!darkTitle && title && (
        <CardHeader
          sx={{ p: 2.5 }}
          title={<Typography variant='h5'>{title}</Typography>}
          action={secondary}
        />
      )}
      {darkTitle && title && (
        <CardHeader
          sx={{ p: 2.5 }}
          title={<Typography variant='h4'>{title}</Typography>}
          action={secondary}
        />
      )}

      {/* content & header divider */}
      {title && (
        <Divider
          sx={{
            opacity: 1,
            borderColor: theme.palette.primary.light,
          }}
        />
      )}

      {/* card content */}
      {content && (
        <CardContent
          sx={{ p: 2.5, ...contentSX }}
          className={contentClass || ''}
        >
          {children}
        </CardContent>
      )}
      {!content && children}
    </Card>
  );
}

export default SubCard;
