# Headless CLI

Run YAET on machines without a desktop (servers, containers, agents).
The headless machine is **read-only**: configure everything in the GUI,
sync it down, and serve MCP/ACP from the synced files. There is no
`cloud upload` on purpose — edit in the GUI, upload there, re-download here.

All commands share one entry point:

```bash
node src-protocol/cli.js <command> [options]
```

## 1. Bootstrap (do once per headless machine)

```bash
# 1. install the master key (hidden prompt, typed twice)
node src-protocol/cli.js masterkey set
# writes <configDir>/.masterkey with mode 0600

# 2. point the environment at it (shell profile, systemd EnvironmentFile, …)
export YAET_MASTER_KEY_FILE=~/.yaet/.masterkey

# 3. pull the GUI-configured profiles/secrets/settings
node src-protocol/cli.js cloud download

# 4. verify
node src-protocol/cli.js doctor

# 5. serve
node src-protocol/cli.js mcp
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
