#!/usr/bin/env node

import { Server } from '../../index';

let app = new Server(
  Server.loadOptions(process, {
    subprotocol: '1.0.0',
    host: '127.0.0.1',
  }),
);
app.nodeId = 'server:FnXaqDxY';

app.auth(async () => true);

app.listen();
