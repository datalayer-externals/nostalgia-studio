import React from 'react';

import Box from '@mui/material/Box';

interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  index?: number;
  value?: number;
  tabs?: string;
  keepMounted?: boolean;
}

export function TabPanel(props: TabPanelProps = { tabs: 'tabs' }) {
  const { children, value, index, tabs, keepMounted, ...other } = props;
  const id = tabs?.toLowerCase().replace(/ /g, '-');

  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`${id}-panel-${index}`}
      aria-labelledby={`${id}-tab-${index}`}
      {...other}
    >
      {(value === index || keepMounted) && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default TabPanel;
