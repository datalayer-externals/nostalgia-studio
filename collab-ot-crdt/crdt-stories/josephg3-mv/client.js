import * as crdt from './crdt.js';

let db = crdt.create ? crdt.create() : {};

const valueElem = document.getElementById('value');
const rawElem = document.getElementById('raw');
const lastElem = document.getElementById('last');
const form = document.getElementById('form');
const textElem = document.getElementById('text');

let ws = null;

const send = (msg) => {
  if (ws != null && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
};

const rerender = () => {
  valueElem.textContent =
    db.length === 1
      ? db[0].value
      : `[${db.map(({ value }) => value).join(', ')}]`;
  // console.log(db);

  rawElem.innerText = `
Internal: ${JSON.stringify(db, null, 2)}
`;
};

const setLastOp = (op) => {
  lastElem.innerText = `
Last: ${JSON.stringify(op, null, 2)}
`;
};

/** 👇🏻 每次提交时，先本地执行op，然后每次发送op而非全量数据到服务端 */
form.onsubmit = (e) => {
  e.preventDefault();

  const op = crdt.set(db, textElem.value || '');
  setLastOp(op);
  db = crdt.merge(db, op);
  console.log('submit!', textElem.value, db);
  send(op);
  rerender();
};

const startConnect = () => {
  const loc = window.location;
  const url =
    (loc.protocol === 'https:' ? 'wss://' : 'ws://') +
    loc.host +
    loc.pathname +
    'ws';
  ws = new WebSocket(url);
  ws.onopen = (e) => {
    console.log('ws-open', e);
    // send(db);
  };

  ws.onmessage = (e) => {
    const op = JSON.parse(e.data);
    console.log('msg', op);
    setLastOp(op);
    if (op.supercedes == null) {
      db = op;
    } else {
      db = crdt.merge(db, op);
    }
    rerender();
  };

  ws.onclose = (e) => {
    console.log('WS closed', e);
    ws = null;
    setTimeout(() => {
      startConnect();
    }, 3000);
  };

  ws.onerror = (e) => {
    console.error('WS error', e);
    // ws = null
  };
};

startConnect();
