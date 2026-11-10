const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  compareVersions,
  loadCurrentVersion,
  replaceAppImage,
} = require('./command');

test('compareVersions orders semver correctly', () => {
  assert.strictEqual(compareVersions('7.6.0', '7.6.0'), 0);
  assert.ok(compareVersions('7.6.1', '7.6.0') > 0);
  assert.ok(compareVersions('7.6.0', '7.6.1') < 0);
  assert.ok(compareVersions('10.0.0', '9.9.9') > 0);
  assert.ok(compareVersions('7.6', '7.6.0') === 0); // missing tail counts as 0
  assert.ok(compareVersions('v7.6.0'.replace(/^v/, ''), '7.6.0') === 0);
});

test('loadCurrentVersion reads the package manifest', () => {
  const v = loadCurrentVersion();
  assert.ok(/^\d+\.\d+\.\d+/.test(v), `unexpected version: ${v}`);
});

test('replaceAppImage writes atomically and leaves no temp file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaet-upgrade-'));
  const target = path.join(dir, 'YetAnotherElectronTerm.AppImage');
  fs.writeFileSync(target, Buffer.from('old-binary'));
  try {
    replaceAppImage(target, Buffer.from('new-binary'));
    assert.strictEqual(fs.readFileSync(target, 'utf8'), 'new-binary');
    const mode = fs.statSync(target).mode & 0o777;
    assert.strictEqual(mode, 0o755);
    assert.strictEqual(fs.readdirSync(dir).length, 1, 'temp file must not linger');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
