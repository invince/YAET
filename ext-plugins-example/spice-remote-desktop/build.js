/**
 * Build script for spice-remote-desktop external plugin.
 *
 * Concatenates spice-client (global UMD build) + Web Components into a single
 * frontend/index.js that can be loaded by the plugin loader.
 */
const fs = require('fs');
const path = require('path');

const SPICE_CLIENT_GLOBAL = path.resolve(__dirname, '../../node_modules/spice-client/dist/global/spice-client.min.js');
const SRC_DIR = path.resolve(__dirname, 'src');
const OUT_DIR = path.resolve(__dirname, 'frontend');

const files = [
  SPICE_CLIENT_GLOBAL,
  path.join(SRC_DIR, 'spice-profile-form.js'),
  path.join(SRC_DIR, 'spice-session.js'),
];

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

let bundle = '// spice-remote-desktop frontend bundle\n';
bundle += '(function(){\n';
bundle += '"use strict";\n\n';

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }
  const content = fs.readFileSync(file, 'utf8');
  bundle += content;
  bundle += '\n\n';
  // After spice-client UMD, extract exports to local vars for Web Components
  if (file === SPICE_CLIENT_GLOBAL) {
    bundle += 'var SpiceMainConn = SpiceClient.SpiceMainConn;\n';
    bundle += 'var SpiceConn = SpiceClient.SpiceConn;\n';
    bundle += 'var SpiceDisplayConn = SpiceClient.SpiceDisplayConn;\n';
    bundle += 'var SpiceInputsConn = SpiceClient.SpiceInputsConn;\n\n';
  }
}

bundle += '})();\n';

// Add plugin metadata
bundle += '\nwindow.__SPICE_REMOTE_DESKTOP_PLUGIN__ = {\n';
bundle += '  manifest: {\n';
bundle += '    id: "spice-remote-desktop",\n';
bundle += '    name: "SPICE Remote Desktop",\n';
bundle += '    category: "REMOTE_DESKTOP",\n';
bundle += '    profileType: "SPICE_REMOTE_DESKTOP",\n';
bundle += '    supportedAuthTypes: ["login", "secret"],\n';
bundle += '    secretTypes: ["PASSWORD_ONLY"],\n';
bundle += '  },\n';
bundle += '  profileFormElement: "spice-profile-form",\n';
bundle += '  sessionElement: "spice-session",\n';
bundle += '};\n';

fs.writeFileSync(path.join(OUT_DIR, 'index.js'), bundle, 'utf8');
console.log('Built frontend/index.js (' + (bundle.length / 1024).toFixed(1) + ' KB)');
