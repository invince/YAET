# Headless CLI

Run YAET on machines without a desktop (servers, containers, agents).
The headless machine has no `cloud upload` on purpose — edit in the GUI,
upload there, re-download here. `cloud setup` only writes the local sync
config (`cloud.json`, encrypted); pushing still happens in the GUI.

The packaged app does **not** unpack: `src-protocol/` ships inside the asar
and the installed binary dispatches CLI commands itself.
From source, the equivalent entry point is `node src-protocol/cli.js`.

```bash
# installed (.deb): full path is /opt/YetAnotherElectronTerm/yet-another-electron-term
/opt/YetAnotherElectronTerm/yet-another-electron-term doctor
/opt/YetAnotherElectronTerm/yet-another-electron-term cloud download
# from source
node src-protocol/cli.js doctor
```

Below, `yaet` is a small shim that forwards to the installed binary
**plus the flags Chromium requires without a display** (same as `--mcp`
headless mode — Electron initializes the Ozone platform before `main()`
runs, so omitting them fails with `Missing X server or $DISPLAY`).
The shim template ships inside the package (`scripts/yaet`, read from
the asar — never unpacked). Install it once (works for every shell,
systemd units, and agents — no per-shell alias needed):

```bash
# first call uses the full path; as root it lands in /usr/local/bin,
# otherwise in ~/.local/bin (add that to PATH yourself)
sudo /opt/YetAnotherElectronTerm/yet-another-electron-term doctor --fix-shim
```

`--disable-gpu --disable-logging` silence the GPU-process and Chromium
stderr spam. The remaining `dbus` ERROR lines are harmless noise on
servers without a session bus. Commands exit promptly with code 0/1
(the CLI calls `process.exit` instead of letting Electron tear down
windowing code that doesn't exist headless).

## 0. Install on a server (no FUSE)

AppImage needs `libfuse.so.2` to run, which headless servers often lack.
Use the .deb release instead:

```bash
sudo apt install ./YetAnotherElectronTerm-*.deb
/opt/YetAnotherElectronTerm/yet-another-electron-term doctor
```

## 1. Bootstrap (do once per headless machine)

```bash
# 0. install the yaet shim (once per machine; needs the .deb present)
sudo /opt/YetAnotherElectronTerm/yet-another-electron-term doctor --fix-shim

# 1. install the master key (hidden prompt, typed twice)
yaet masterkey set
# writes <configDir>/.masterkey with mode 0600

# 2. point the environment at it (shell profile, systemd EnvironmentFile, …)
export YAET_MASTER_KEY_FILE=~/.yaet/.masterkey

# 3. point the sync config at your git repo (new machine only;
#    skip if you copied ~/.yaet/cloud.json over from the GUI machine)
yaet cloud setup --url https://gitea.example.com/you/yaet-config.git \
  --login you --password-stdin <<<"$GIT_PASSWORD"
# --download chains a download right after writing the config

# 4. pull the GUI-configured profiles/secrets/settings
yaet cloud download

# 5. verify
yaet doctor

# 6. serve (existing flag, unchanged — headless flags already in the shim)
yaet --mcp
```

Config dir is `~/.yaet` (`$YAET_HOME` overrides the base,
`NODE_ENV=development` uses the isolated `~/.yaet-debug`).

## 2. Command reference

### `masterkey set [--file <path>] [--key <key> | --stdin] [--force]`

Stores the master key in a `0600` file. Default path is
`$YAET_MASTER_KEY_FILE` if set, else `<configDir>/.masterkey`.
Key input, in order of preference for headless use:

1. `--stdin` (recommended): `printf '%s' "$KEY" | yaet masterkey set --stdin`.
   No TTY games, no echo, nothing visible in `ps`. Single entry —
   confirm the key out-of-band before piping.
2. Interactive prompt (needs a TTY): hidden, typed twice (`[1/2]`, `[2/2]`).
3. `--key` (discouraged): leaks into shell history and `ps` output;
   automation without a TTY only.

If `profiles.json` already exists, the key is verified against it before
writing (use `--force` to override).

### `masterkey check [--master-key <key>]`

Resolves the key and probes decryption of `profiles.json`.
Prints the source (`env:` / `file:` / `keyring`) and key length —
never the key itself. Exit 1 on failure.

### `cloud status [--master-key <key>]`

Decrypts `cloud.json` and shows the sync URL (credentials masked),
login, synced items, which files exist locally, and whether the
configured proxy id resolves. Fails clearly when `cloud.json` is
absent ("configure cloud sync in the GUI first").

### `cloud setup --url <git-url> --login <user> [...]`

Writes the local sync config (`cloud.json`, encrypted with the master key)
on a fresh headless machine — the step `cloud download` needs before its
first run. Existing `cloud.json` requires `--force` (or a TTY confirm).

```bash
# --password-stdin preferred (nothing in history/ps);
# omit password flags for a hidden TTY prompt
printf '%s' "$GIT_PASSWORD" | yaet cloud setup \
  --url https://gitea.example.com/you/yaet-config.git \
  --login you --password-stdin

# options
# --download        run a download right after writing the config
# --password <pw>   discouraged: leaks into history/ps; TTY-less automation only
```

### `cloud download [--master-key <key>]`

Clones the sync repo and replaces the local JSON files.
Existing files are backed up to `<configDir>/backup/` first
(handled inside `CloudService`). Prints per-file `ok:` / `ko:` lines.

### `doctor [--fix-shim]`

Local-only self-check, no network: config dir, key resolution,
`settings.json` parse, per-file decrypt of
`profiles/secrets/cloud/proxies.json` (missing = `[WARN]`,
undecryptable = `[FAIL]`), URL presence in `cloud.json`, and whether
the `yaet` shim is on PATH (missing = `[WARN]`).
Exit 0 only when there are no `[FAIL]` lines.

`--fix-shim` installs the shim when absent: `/usr/local/bin/yaet`
as root, otherwise `~/.local/bin/yaet` (you may need to add
`~/.local/bin` to PATH yourself).

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
| `No cloud.json found…` | never configured here — run `cloud setup` or copy `cloud.json` from the GUI machine |
| `doctor` FAIL on one file only | that file was overwritten while the key mismatched — restore from `backup/` or re-download |
| `dlopen(): error loading libfuse.so.2` | AppImage needs FUSE — use the .deb release instead (see §0) |
| `Missing X server or $DISPLAY` | Chromium headless flags missing — call through the `yaet` shim, not the raw binary |
| `Unknown command/subcommand` | bare form needs the full words, e.g. `masterkey set` — not `masterkey se` |
