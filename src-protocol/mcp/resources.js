/**
 * MCP Resources for YAET (B4).
 *
 * Read-only context the agent can pull without executing anything:
 * - `yaet://profiles`    — profile inventory (identity only: id/name/type/
 *   category; never hosts, credentials or secrets — same P0-1 policy as the
 *   `yaet_profiles` tool; the agent resolves credentials server-side via
 *   profileName).
 * - `yaet://settings/ai` — AI assistant settings with the API token redacted.
 */
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const { getAppConfigPath } = require('../../src-electron/services/envConfig');

const REDACTED = '***redacted***';

function readSettings() {
  const file = path.join(getAppConfigPath(), 'settings.json');
  if (!fs.existsSync(file)) throw new Error('settings.json not found — open the YAET GUI once to create it');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readProfiles(getMasterKey) {
  const file = path.join(getAppConfigPath(), 'profiles.json');
  if (!fs.existsSync(file)) throw new Error('profiles.json not found — open the YAET GUI once to create it');
  const raw = fs.readFileSync(file, 'utf8');
  return getMasterKey().then((key) => {
    const dec = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
    if (!dec) throw new Error('Failed to decrypt profiles.json (wrong master key?)');
    return JSON.parse(dec).profiles || [];
  });
}

function textContents(uri, text) {
  return [{ uri, mimeType: 'application/json', text }];
}

function createResources(getMasterKey) {
  return [
    {
      uri: 'yaet://profiles',
      name: 'profiles',
      description: 'YAET connection profile inventory (id, name, type, category). No hosts or credentials — resolve those server-side via profileName.',
      handler: async () => {
        const profiles = await readProfiles(getMasterKey);
        const safe = profiles.map((p) => ({
          id: p.id,
          name: p.name,
          profileType: p.profileType,
          category: p.category,
          group: p.group || '',
        }));
        return textContents('yaet://profiles', JSON.stringify(safe, null, 2));
      },
    },
    {
      uri: 'yaet://settings/ai',
      name: 'ai-settings',
      description: 'YAET AI assistant settings (mode, model, endpoints). The API token is always redacted.',
      handler: async () => {
        const settings = readSettings();
        const ai = { ...(settings.ai || {}) };
        if (ai.token) ai.token = REDACTED;
        return textContents('yaet://settings/ai', JSON.stringify(ai, null, 2));
      },
    },
  ];
}

module.exports = { createResources };
