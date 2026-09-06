/**
 * Environment-aware configuration (single source of truth).
 *
 * Local debug builds (`NODE_ENV=development`, i.e. `npm run electron:dev` /
 * `npm start`) use an ISOLATED data directory (`.yaet-debug`) and ISOLATED
 * keytar credentials, so local testing can never read or overwrite the
 * production `~/.yaet` files or the production master key. This separation
 * exists because a key/data mismatch destroys data (decrypt fails, and any
 * subsequent save would overwrite good ciphertext with empty blobs).
 *
 *   production (NODE_ENV unset)  →  ~/.yaet  + prod keytar identity
 *   development                  →  ~/.yaet-debug + debug keytar identity
 *   e2e (NODE_ENV=e2e)           →  $YAET_HOME/.yaet (temp dir, mocked keytar)
 *
 * Override: YAET_HOME changes the base directory (used by e2e temp dirs).
 * Run `NODE_ENV=development npm run mcp` to point the MCP server at debug data
 * (master key still comes from YAET_MASTER_KEY env).
 *
 * Leaf module: only path/os/process — safe to require from anywhere,
 * including src-protocol (asar-packed) and scripts/.
 */
const path = require('path');
const os = require('os');

const PROD_KEYTAR_SERVICE = 'io.github.invince.YAET';
const PROD_KEYTAR_ACCOUNT = 'ac13ba1ac2f841d19a9f73bd8c335086';
const DEBUG_KEYTAR_SERVICE = 'io.github.invince.YAET.debug';
const DEBUG_KEYTAR_ACCOUNT = 'local-debug-only';

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function getBaseDir() {
  return process.env.YAET_HOME || os.homedir();
}

function getConfigDirName() {
  return isDevelopment() ? '.yaet-debug' : '.yaet';
}

function getAppConfigPath() {
  return path.join(getBaseDir(), getConfigDirName());
}

function getKeytarIdentity() {
  if (isDevelopment()) {
    return { service: DEBUG_KEYTAR_SERVICE, account: DEBUG_KEYTAR_ACCOUNT };
  }
  return { service: PROD_KEYTAR_SERVICE, account: PROD_KEYTAR_ACCOUNT };
}

module.exports = {
  isDevelopment,
  getBaseDir,
  getConfigDirName,
  getAppConfigPath,
  getKeytarIdentity,
  PROD_KEYTAR_SERVICE,
  PROD_KEYTAR_ACCOUNT,
  DEBUG_KEYTAR_SERVICE,
  DEBUG_KEYTAR_ACCOUNT,
};
