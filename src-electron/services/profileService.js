/**
 * YAET Profile/Secret Resolution Module
 * Wraps credentialResolver with keytar (OS keyring) as master key source.
 * Used by Electron main process (runtimeAPI.js).
 */
const keytar = require('keytar');
const { resolveConfig, listSSHProfiles } = require('../../src-protocol/common/credentialResolver');

const SERVICE = 'io.github.invince.YAET';
const ACCOUNT = 'ac13ba1ac2f841d19a9f73bd8c335086';

async function getMasterKey() {
  const key = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!key) throw new Error('YAET master key not found in keyring');
  return key;
}

class ProfileService {
  constructor(log) {
    this.log = log;
  }

  async resolveSSHConfigByName(profileName) {
    return resolveConfig({ profileName }, getMasterKey);
  }

  async resolveSSHConfigById(profileId) {
    return resolveConfig({ profileId }, getMasterKey);
  }

  async listSSHProfiles() {
    return listSSHProfiles(getMasterKey);
  }

  async resolveSCPConfig(profileName) {
    return this.resolveSSHConfigByName(profileName);
  }
}

module.exports = { ProfileService };
