import { Server } from '@logux/server';

import { subprotocol } from '../protocol/index';

const server = new Server(
  Server.loadOptions(process, {
    subprotocol,
    supports: subprotocol,
    fileUrl: import.meta.url,
  }),
);

server
  .autoloadModules(
    process.env.NODE_ENV === 'production'
      ? 'modules/*.js'
      : ['modules/*.ts', '!modules/*.test.ts'],
  )
  .then(() => {
    server.listen();
  });
