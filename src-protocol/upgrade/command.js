/**
 * `yaet upgrade [--check]` — self-upgrade for headless CLI installs.
 *
 * Layouts:
 *   - AppImage install (created by install.sh):
 *       ~/.local/bin/YetAnotherElectronTerm.AppImage — replaced in place
 *       (download to a temp file in the same dir, chmod +x, atomic rename).
 *   - /opt system install (deb/rpm): cannot self-upgrade — prints guidance.
 *   - source checkout: suggests running install.sh.
 *
 * Current version is read from the package manifest (works inside the asar).
 * Latest release comes from the GitHub API of the release repo, same repo
 * install.sh uses. Asset resolution mirrors install.sh: a direct
 * browser_download_url ending in .AppImage, falling back to the `path:` line
 * inside latest-linux.yml (electron-updater artifact naming).
 *
 * --check only compares versions and reports; never downloads.
 * Exit 0 when up to date or upgraded successfully, 1 otherwise.
 */
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const RELEASE_REPO = 'invince/YAET-RELEASE';
const APPIMAGE_PATH = path.join(os.homedir(), '.local', 'bin', 'YetAnotherElectronTerm.AppImage');
const OPT_BINARY = '/opt/YetAnotherElectronTerm/yet-another-electron-term';
const OPT_ASAR = path.join(OPT_BINARY, '..', 'resources', 'app.asar');

function loadCurrentVersion() {
  // src-protocol/upgrade/command.js -> <root>/package.json (also inside asar)
  const manifest = path.join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  return String(pkg.version || '');
}

/** Compare dotted numeric versions ("7.6.0"); non-numeric tails are ignored. */
function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).map((s) => parseInt(s, 10));
  const pb = String(b).split(/[.-]/).map((s) => parseInt(s, 10));
  for (let i = 0; i < 3; i++) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * https GET following redirects; resolve(Buffer) for raw, resolve(String)
 * when a text encoding is given.
 */
function httpsGet(url, encoding = null, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const request = (target, left) => {
      https.get(target, { headers: { 'User-Agent': 'YAET-CLI' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (left <= 0) return reject(new Error('too many redirects'));
          res.resume();
          const next = new URL(res.headers.location, target).toString();
          return request(next, left - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${target}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve(encoding ? buf.toString(encoding) : buf);
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    request(url, maxRedirects);
  });
}

async function fetchLatestRelease() {
  const url = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
  const json = JSON.parse(await httpsGet(url, 'utf8'));
  if (!json.tag_name) throw new Error(`no releases found for ${RELEASE_REPO}`);
  const tag = String(json.tag_name);
  let appimageUrl = (json.assets || [])
    .map((a) => a.browser_download_url)
    .find((u) => /\.AppImage$/i.test(u)) || null;
  if (!appimageUrl) {
    // Fallback used by install.sh: resolve the artifact name from
    // latest-linux.yml (electron-updater), then build the download URL.
    const ymlAsset = (json.assets || []).find((a) => /latest-linux\.yml$/.test(a.name || ''));
    if (ymlAsset) {
      const yml = await httpsGet(ymlAsset.browser_download_url, 'utf8');
      const file = (yml.match(/^path:\s*(\S+)\s*$/m) || [])[1];
      if (file) appimageUrl = `https://github.com/${RELEASE_REPO}/releases/download/${tag}/${file}`;
    }
  }
  return { tag, version: tag.replace(/^v/, ''), appimageUrl };
}

function detectInstall() {
  if (fs.existsSync(APPIMAGE_PATH)) return { kind: 'appimage', target: APPIMAGE_PATH };
  if (fs.existsSync(OPT_BINARY)) return { kind: 'system', target: OPT_BINARY };
  return { kind: 'none', target: null };
}

function replaceAppImage(target, data) {
  // Atomic-ish replace: write a temp file in the same dir, chmod, rename.
  const tmp = `${target}.upgrade-tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o755 });
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, target);
}

async function runUpgrade(argv) {
  const args = argv || [];
  for (const a of args) {
    if (a !== '--check') throw new Error(`Unknown option: ${a}`);
  }
  const checkOnly = args.includes('--check');

  const current = loadCurrentVersion();
  const install = detectInstall();
  console.log(`current version: ${current}`);
  console.log(`install layout: ${install.kind}${install.target ? ` (${install.target})` : ''}`);

  if (install.kind === 'none') {
    console.error('No installed YAET binary found (looked in /opt/YetAnotherElectronTerm and ~/.local/bin).');
    console.error('For a fresh install, run: curl -fsSL https://raw.githubusercontent.com/invince/YAET/master/install.sh | bash');
    throw new Error('nothing to upgrade');
  }
  if (install.kind === 'system') {
    if (fs.existsSync(OPT_ASAR)) console.log(`asar readable: ${OPT_ASAR}`);
    console.error('/opt system installs (deb/rpm) cannot self-upgrade — reinstall the package or use install.sh (AppImage).');
    throw new Error('unsupported install layout');
  }

  const latest = await fetchLatestRelease();
  console.log(`latest release: ${latest.tag}`);

  if (compareVersions(latest.version, current) <= 0) {
    console.log('already up to date.');
    return;
  }
  if (!latest.appimageUrl) throw new Error(`release ${latest.tag} has no .AppImage asset`);
  if (checkOnly) {
    console.log(`update available: ${current} -> ${latest.version} (${latest.appimageUrl})`);
    console.log('re-run without --check to download and install.');
    return;
  }

  console.log(`downloading ${latest.appimageUrl} ...`);
  const data = await httpsGet(latest.appimageUrl);
  replaceAppImage(install.target, data);
  console.log(`installed ${latest.version} at ${install.target}`);
}

module.exports = { runUpgrade, loadCurrentVersion, compareVersions, fetchLatestRelease, detectInstall, replaceAppImage, RELEASE_REPO };
