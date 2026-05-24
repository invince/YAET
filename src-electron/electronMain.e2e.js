const path = require('path');
const mock = require('./adapter/ui-ipc/security.mock');

const cachePath = path.join(__dirname, 'adapter', 'ui-ipc', 'security.js');
require.cache[cachePath] = { exports: mock, loaded: true };

require('./electronMain');
