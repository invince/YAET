const path = require('path');
const mock = require('./ipc/security.mock');

const cachePath = path.join(__dirname, 'ipc', 'security.js');
require.cache[cachePath] = { exports: mock, loaded: true };

require('./electronMain');
