/**
 * YAET credential resolver — pure JS, no native modules.
 * Reads encrypted profiles.json / secrets.json from ~/.yaet/.
 * Master key source is injected via getMasterKey callback.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const CryptoJS = require('crypto-js');

const YAET_DIR = path.join(os.homedir(), '.yaet');

async function decryptFile(filename, getMasterKey) {
  const file = path.join(YAET_DIR, filename);
  const raw = fs.readFileSync(file, 'utf8');
  const masterKey = await getMasterKey();
  const dec = CryptoJS.AES.decrypt(raw, masterKey).toString(CryptoJS.enc.Utf8);
  if (!dec) throw new Error(`Failed to decrypt ${filename} (wrong master key?)`);
  return JSON.parse(dec);
}

async function loadProfiles(getMasterKey) {
  const data = await decryptFile('profiles.json', getMasterKey);
  return data.profiles || [];
}

async function loadSecrets(getMasterKey) {
  const data = await decryptFile('secrets.json', getMasterKey);
  const map = {};
  for (const s of data.secrets || []) map[s.id] = s;
  return map;
}

async function findProfileByName(name, getMasterKey) {
  const profiles = await loadProfiles(getMasterKey);
  let p = profiles.find(x => x.name === name);
  if (!p) {
    const matches = profiles.filter(x => x.name && x.name.startsWith(name));
    if (matches.length === 1) p = matches[0];
    else if (matches.length > 1) throw new Error(`Ambiguous profile '${name}': ${matches.map(m => m.name).join(', ')}`);
    else throw new Error(`Profile not found: '${name}'`);
  }
  return p;
}

async function resolveConfig(args, getMasterKey) {
  if (args.profileName) {
    const p = await findProfileByName(args.profileName, getMasterKey);
    const sh = p.profileData && p.profileData.SSH_TERMINAL;
    if (!sh || !sh.host) throw new Error(`Profile '${args.profileName}' is not an SSH profile`);

    const config = { host: sh.host, port: sh.port || 22 };

    const authType = sh.authType || 'login';
    if (authType === 'secret' && sh.secretId) {
      const secrets = await loadSecrets(getMasterKey);
      const sec = secrets[sh.secretId];
      if (!sec) throw new Error(`Secret not found for profile '${args.profileName}'`);
      if (sec.login) config.username = sec.login;
      if (sec.password) config.password = sec.password;
    } else {
      if (sh.login) config.username = sh.login;
      if (sh.password) config.password = sh.password;
    }
    if (!config.username) throw new Error(`No username resolved for profile '${args.profileName}'`);

    if (sh.privateKey) {
      const keyPath = path.resolve(sh.privateKey.replace(/^~/, os.homedir()));
      config.privateKey = fs.readFileSync(keyPath, 'utf8');
    }
    return config;
  }

  const { host, port = 22, username, password, privateKey } = args;
  if (!host || !username) throw new Error('Provide either profileName or host+username');
  const config = { host, port, username };
  if (password) config.password = password;
  if (privateKey) {
    if (privateKey.includes('-----BEGIN')) {
      config.privateKey = privateKey;
    } else {
      const keyPath = path.resolve(privateKey.replace(/^~/, os.homedir()));
      config.privateKey = fs.readFileSync(keyPath, 'utf8');
    }
  }
  return config;
}

async function listSSHProfiles(getMasterKey) {
  const profiles = await loadProfiles(getMasterKey);
  // P0-1: expose identity only — no host/port/authType, no secrets.
  // Agent resolves credentials server-side via profileName.
  return profiles
    .filter(p => p.profileData && p.profileData.SSH_TERMINAL && p.profileData.SSH_TERMINAL.host)
    .map(p => ({
      id: p.id,
      name: p.name,
    }));
}

module.exports = { resolveConfig, listSSHProfiles };
