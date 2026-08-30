/**
 * YAET Profile/Secret Resolution Module (Shared)
 *
 * Resolves connection credentials by profile name or ID for IPC/AI/MCP/ACP adapters.
 * Credentials flow only in process memory — never logged, never persisted, never returned.
 *
 * Data sources (~/.yaet/):
 *   - profiles.json  (AES encrypted): connection profiles, profileData.SSH_TERMINAL{host,port,authType,secretId,...}
 *   - secrets.json   (AES encrypted): secret entries {id,secretType,name,login,password}
 * Master key stored in system keyring (keytar)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const keytar = require('keytar');
const CryptoJS = require('crypto-js');

const SERVICE = 'io.github.invince.YAET';
const ACCOUNT = 'ac13ba1ac2f841d19a9f73bd8c335086';
const YAET_DIR = path.join(os.homedir(), '.yaet');

class ProfileService {
  constructor(log) {
    this.log = log;
  }

  /** Read master key from system keyring */
  async _getMasterKey() {
    const key = await keytar.getPassword(SERVICE, ACCOUNT);
    if (!key) throw new Error('YAET master key not found in keyring');
    return key;
  }

  /** Decrypt and parse an encrypted JSON file */
  async _decryptFile(filename) {
    const file = path.join(YAET_DIR, filename);
    const raw = fs.readFileSync(file, 'utf8');
    const masterKey = await this._getMasterKey();
    const dec = CryptoJS.AES.decrypt(raw, masterKey).toString(CryptoJS.enc.Utf8);
    if (!dec) throw new Error(`Failed to decrypt ${filename} (wrong master key?)`);
    return JSON.parse(dec);
  }

  async _loadProfiles() {
    const data = await this._decryptFile('profiles.json');
    return data.profiles || [];
  }

  async _loadSecrets() {
    const data = await this._decryptFile('secrets.json');
    const map = {};
    for (const s of data.secrets || []) map[s.id] = s;
    return map;
  }

  /** Find profile by exact name, with optional prefix fuzzy match */
  async findProfileByName(name) {
    const profiles = await this._loadProfiles();
    let p = profiles.find(x => x.name === name);
    if (!p) {
      const matches = profiles.filter(x => x.name && x.name.startsWith(name));
      if (matches.length === 1) p = matches[0];
      else if (matches.length > 1) throw new Error(`Ambiguous profile '${name}': ${matches.map(m=>m.name).join(', ')}`);
      else throw new Error(`Profile not found: '${name}'`);
    }
    return p;
  }

  /** Find profile by exact ID */
  async findProfileById(id) {
    const profiles = await this._loadProfiles();
    const p = profiles.find(x => x.id === id);
    if (!p) throw new Error(`Profile not found: '${id}'`);
    return p;
  }

  /** List all available SSH/SFTP profiles (for tools/list discovery) */
  async listSSHProfiles() {
    const profiles = await this._loadProfiles();
    return profiles
      .filter(p => p.profileData && p.profileData.SSH_TERMINAL && p.profileData.SSH_TERMINAL.host)
      .map(p => ({
        id: p.id,
        name: p.name,
        host: p.profileData.SSH_TERMINAL.host,
        port: p.profileData.SSH_TERMINAL.port || 22,
        authType: p.profileData.SSH_TERMINAL.authType || 'unknown',
      }));
  }

  /** Resolve ssh2 connection config from profile object */
  async _resolveSSHConfigFromProfile(profile, profileLabel) {
    const sh = profile.profileData && profile.profileData.SSH_TERMINAL;
    if (!sh || !sh.host) throw new Error(`Profile '${profileLabel}' is not an SSH profile`);

    const config = {
      host: sh.host,
      port: sh.port || 22,
    };

    const authType = sh.authType || 'login';
    if (authType === 'secret' && sh.secretId) {
      const secrets = await this._loadSecrets();
      const sec = secrets[sh.secretId];
      if (!sec) throw new Error(`Secret not found for profile '${profileLabel}' (id=${sh.secretId})`);
      if (sec.login) config.username = sec.login;
      if (sec.password) config.password = sec.password;
    } else {
      if (sh.login) config.username = sh.login;
      if (sh.password) config.password = sh.password;
    }
    if (!config.username) throw new Error(`No username resolved for profile '${profileLabel}'`);

    if (sh.privateKey) {
      const keyPath = path.resolve(sh.privateKey.replace(/^~/, os.homedir()));
      config.privateKey = fs.readFileSync(keyPath, 'utf8');
    }

    return config;
  }

  /** Resolve profile by name -> ssh2 connection config */
  async resolveSSHConfigByName(profileName) {
    const p = await this.findProfileByName(profileName);
    return this._resolveSSHConfigFromProfile(p, profileName);
  }

  /** Resolve profile by ID -> ssh2 connection config */
  async resolveSSHConfigById(profileId) {
    const p = await this.findProfileById(profileId);
    return this._resolveSSHConfigFromProfile(p, profileId);
  }

  /** Resolve SFTP/SCP file operation config (reuses SSH config) */
  async resolveSCPConfig(profileName) {
    return this.resolveSSHConfigByName(profileName);
  }
}

module.exports = { ProfileService };
