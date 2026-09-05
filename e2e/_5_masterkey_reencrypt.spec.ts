import {expect, test} from './fixtures';
import {AppPage} from './app.po';
import path from 'path';
import fs from 'fs';
import CryptoJS from 'crypto-js';

const KEY1 = 'first-key-123';
const KEY2 = 'second-key-456';

async function waitForNoSnackbar(mainWindow: any) {
  const bar = mainWindow.locator('.mat-mdc-snack-bar-container');
  for (let i = 0; i < 6; i++) {
    if (await bar.count() === 0) return;
    await mainWindow.waitForTimeout(1500);
  }
}

function enc(obj: any, key: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(obj), key).toString();
}
// Returns null if the file is absent OR the key can't decrypt it.
function decryptFileSafe(yaetDir: string, name: string, key: string): any {
  const p = path.join(yaetDir, name);
  if (!fs.existsSync(p)) return null;
  try {
    const ct = fs.readFileSync(p, 'utf-8');
    const s = CryptoJS.AES.decrypt(ct, key).toString(CryptoJS.enc.Utf8);
    return s ? JSON.parse(s) : null;
  } catch {
    return null; // wrong key -> Malformed UTF-8 / parse error
  }
}

// Seed real profiles + secrets encrypted under KEY1, then change the master key
// through the real UI (correct old password). The main process must migrate the
// on-disk files to KEY2 WITHOUT losing profileData/secret data.
test('profile secret survives real UI master-key change (main-process re-encrypt)', async ({ mainWindow, tempUserData }) => {
  const app = new AppPage(mainWindow);
  const yaetDir = path.join(tempUserData, '.yaet');
  fs.mkdirSync(yaetDir, { recursive: true });

  const SECRET_ID = 'seed-sec-001';
  const profile = {
    id: 'seed-prof-001', name: 'Seed SSH', comment: '', icon: 'terminal',
    category: 'TERMINAL', profileType: 'SSH_TERMINAL', group: '', tags: [],
    proxyId: '', favoritePaths: [], isNew: false,
    profileData: {
      SSH_TERMINAL: { host: '10.20.30.40', port: 22, authType: 'secret', login: '', password: '', secretId: SECRET_ID },
    },
  };
  const profiles = { revision: Date.now(), profiles: [profile], version: '7.2.3', compatibleVersion: '1.0.0' };
  const secrets = { revision: Date.now(), secrets: [{ id: SECRET_ID, name: 'SeedSecret', login: 'seeduser', password: 'seedpass', secretType: 'LOGIN_PASSWORD', isNew: false }], version: '7.2.3', compatibleVersion: '1.0.0' };

  fs.writeFileSync(path.join(yaetDir, 'profiles.json'), enc(profiles, KEY1), 'utf-8');
  fs.writeFileSync(path.join(yaetDir, 'secrets.json'), enc(secrets, KEY1), 'utf-8');

  // The mock keytar must start holding KEY1 so the seeded files can be decrypted.
  await app.invoke('masterkey.save', KEY1);
  await waitForNoSnackbar(mainWindow);
  await mainWindow.waitForTimeout(1500);

  // Sanity: before change, disk is readable with KEY1.
  const beforeProf = decryptFileSafe(yaetDir, 'profiles.json', KEY1);
  expect(beforeProf).not.toBeNull();
  const beforeAuth = beforeProf.profiles[0].profileData['SSH_TERMINAL'];
  expect(beforeAuth.secretId).toBe(SECRET_ID);

  // Real UI change flow.
  await app.guardedButton('Settings').click();
  await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
  await app.setMasterKeyInSettings.click();
  await expect(app.masterKeyDialog).toBeVisible({ timeout: 5000 });
  await app.masterKeyInput('oldPassword').fill(KEY1);
  await app.masterKeyInput('newPassword').fill(KEY2);
  await app.masterKeyInput('confirmPassword').fill(KEY2);
  await app.masterKeySubmit.click();
  await expect(app.masterKeyDialog).not.toBeVisible({ timeout: 5000 });
  await waitForNoSnackbar(mainWindow);

  // After change: master key is KEY2 and the files must be readable with KEY2,
  // with the profileData + secret fully intact (this was the data-loss bug).
  const match = await app.invoke('masterkey.match', KEY2);
  expect(match).toBe(true);

  const afterProf = decryptFileSafe(yaetDir, 'profiles.json', KEY2);
  const afterSec = decryptFileSafe(yaetDir, 'secrets.json', KEY2);
  expect(afterProf, 'profiles.json should be decryptable with KEY2').not.toBeNull();
  expect(afterSec, 'secrets.json should be decryptable with KEY2').not.toBeNull();

  const auth = afterProf.profiles[0].profileData['SSH_TERMINAL'];
  expect(auth.host).toBe('10.20.30.40');
  expect(auth.secretId).toBe(SECRET_ID);
  expect(afterSec.secrets[0].login).toBe('seeduser');
  expect(afterSec.secrets[0].password).toBe('seedpass');

  // Old key must no longer decrypt the migrated files (they were truly re-encrypted).
  const oldKeyRead = decryptFileSafe(yaetDir, 'profiles.json', KEY1);
  expect(oldKeyRead).toBeNull();
});
