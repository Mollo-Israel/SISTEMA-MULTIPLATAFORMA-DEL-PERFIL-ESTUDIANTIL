// Pruebas unitarias en TypeScript con el runner nativo de Node, sin Jest.
// Solo transpila (sin chequeo de tipos): el chequeo lo hace `tsc --noEmit`.
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.TS_NODE_PROJECT = require('path').join(__dirname, '..', 'tsconfig.json');
require('ts-node/register');
