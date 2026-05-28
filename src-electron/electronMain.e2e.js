const path = require('path');
const mock = require('./adapter/ipc/security.mock');

const cachePath = path.join(__dirname, 'adapter', 'ipc', 'security.js');
require.cache[cachePath] = { exports: mock, loaded: true };

require('./electronMain');
