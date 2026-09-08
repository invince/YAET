# Headless CLI

Run YAET on machines without a desktop (servers, containers, agents).
The headless machine is **read-only**: configure everything in the GUI,
sync it down, and serve MCP/ACP from the synced files. There is no
`cloud upload` on purpose — edit in the GUI, upload there, re-download here.

The packaged app does **not** unpack: `src-protocol/` ships inside the asar
and the installed binary dispatches CLI commands itself.
From source, the equivalent entry point is `node src-protocol/cli.js`.

```bash
# installed (.deb): full path is /opt/YetAnotherElectronTerm/yet-another-electron-term
/opt/YetAnotherElectronTerm/yet-another-electron-term doctor
/opt/YetAnotherElectronTerm/yet-another-electron-term cloud download
# AppImage without FUSE: extract once, run AppRun (see §0)
./squashfs-root/AppRun doctor
# from source
node src-protocol/cli.js doctor
```

Below uses `yaet` as shorthand for `/opt/YetAnotherElectronTerm/yet-another-electron-term`
(`alias yaet=/opt/YetAnotherElectronTerm/yet-another-electron-term`).
`--cli …` is accepted as an equivalent prefix, e.g. `yaet --cli doctor`.

## 0. Install on a server (no FUSE)

AppImage needs `libfuse.so.2` to run, which headless servers often lack.
Two supported ways around it:

```bash
# option A (recommended): use the .deb release instead of AppImage
sudo apt install ./YetAnotherElectronTerm-*.deb
/opt/YetAnotherElectronTerm/yet-another-electron-term doctor

# option B: extract the AppImage once, run AppRun directly (no FUSE needed)
./YetAnotherElectronTerm.AppImage --appimage-extract
./squashfs-root/AppRun doctor
```

## 1. Bootstrap (do once per headless machine)

```bash
# 1. install the master key (hidden prompt, typed twice)
yaet masterkey set
# writes <configDir>/.masterkey with mode 0600

# 2. point the environment at it (shell profile, systemd EnvironmentFile, …)
export YAET_MASTER_KEY_FILE=~/.yaet/.masterkey

# 3. pull the GUI-configured profiles/secrets/settings
yaet cloud download

# 4. verify
yaet doctor

# 5. serve (existing flag, unchanged)
yaet --mcp --no-sandbox --ozone-platform=headless
```

Config dir is `~/.yaet` (`$YAET_HOME` overrides the base,
`NODE_ENV=development` uses the isolated `~/.yaet-debug`).

## 2. Command reference

### `masterkey set [--file <path>] [--key <key>] [--force]`

Stores the master key in a `0600` file. Default path is
`$YAET_MASTER_KEY_FILE` if set, else `<configDir>/.masterkey`.
Without `--key` it prompts on `/dev/tty` (hidden, confirmed twice);
without a TTY `--key` is required. If `profiles.json` already exists,
the key is verified against it before writing (use `--force` to override).

### `masterkey check [--master-key <key>]`

Resolves the key and probes decryption of `profiles.json`.
Prints the source (`env:` / `file:` / `keyring`) and key length —
never the key itself. Exit 1 on failure.

### `cloud status [--master-key <key>]`

Decrypts `cloud.json` and shows the sync URL (credentials masked),
login, synced items, which files exist locally, and whether the
configured proxy id resolves. Fails clearly when `cloud.json` is
absent ("configure cloud sync in the GUI first").

### `cloud download [--master-key <key>]`

Clones the sync repo and replaces the local JSON files.
Existing files are backed up to `<configDir>/backup/` first
(handled inside `CloudService`). Prints per-file `ok:` / `ko:` lines.

### `doctor`

Local-only self-check, no network: config dir, key resolution,
`settings.json` parse, per-file decrypt of
`profiles/secrets/cloud/proxies.json` (missing = `[WARN]`,
undecryptable = `[FAIL]`), and URL presence in `cloud.json`.
Exit 0 only when there are no `[FAIL]` lines.

## 3. Master key resolution order

Explicit `--master-key` → `YAET_MASTER_KEY` →
`YAET_MASTER_KEY_FILE` (single trailing newline stripped) →
OS keyring via keytar (desktop only). MCP/ACP servers and all
commands above use this same order (`src-protocol/common/masterKey.js`).

Keep the key file at `0600`, owned by the user running the server.
Back it up together with `~/.yaet` — losing it means the encrypted
JSONs cannot be decrypted.

## 4. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `No master key found…` | neither env var set and no keyring — run `masterkey set` |
| `decrypt failed (wrong master key?)` | key file doesn't match the key that encrypted the JSONs — restore the matching-era key |
| `No cloud.json found…` | cloud sync was never configured/uploaded in the GUI |
| `doctor` FAIL on one file only | that file was overwritten while the key mismatched — restore from `backup/` or re-download |
| `dlopen(): error loading libfuse.so.2` | AppImage needs FUSE — use the .deb release or `--appimage-extract` (see §0) |
| `Unknown command/subcommand` | bare form needs the full words, e.g. `masterkey set` — not `masterkey se` |
