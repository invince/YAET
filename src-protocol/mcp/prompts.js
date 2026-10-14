/**
 * MCP Prompts for YAET (B4) — reusable, pre-reviewed workflows the agent can
 * instantiate via prompts/get. Names are ASCII (MCP convention);
 * descriptions and message bodies are bilingual (EN/中文).
 */

function userMessage(text) {
  return { role: 'user', content: { type: 'text', text } };
}

function createPrompts() {
  return [
    {
      name: 'backup-audit',
      description: '备份巡检 Backup audit: verify YAET stores decrypt, backups exist, and cloud sync is configured.',
      arguments: [],
      handler: async () => ({
        description: '备份巡检 Backup audit',
        messages: [
          userMessage(
            [
              'Run a YAET backup audit（备份巡检）:',
              '',
              '1. Call the `yaet_profiles` tool and record how many SSH profiles exist.',
              '2. Read the `yaet://settings/ai` resource (sanity check that settings parse; report mode/model only, never secrets).',
              '3. Ask me whether the OS keyring holds the master key; if this is a headless machine, recommend YAET_MASTER_KEY_FILE instead of YAET_MASTER_KEY.',
              '4. Check local_execute availability and, only with my explicit confirmation, verify that profiles.json / secrets.json decrypt (report OK/FAIL per file, never print decrypted content).',
              '5. Report: profile count, settings health, backup recommendations (Settings → Backup → include profiles+secrets, store the zip off-machine).',
              '',
              'Do NOT print or exfiltrate any credential, token or decrypted secret at any step.',
            ].join('\n'),
          ),
        ],
      }),
    },
    {
      name: 'batch-upgrade',
      description: '批量升级 Batch upgrade: run the same maintenance command across multiple SSH profiles, with per-host confirmation.',
      arguments: [
        { name: 'command', description: 'Maintenance command to run on every target (e.g. "sudo apt update && sudo apt upgrade -y").', required: false },
        { name: 'target', description: 'Profile name prefix filter (e.g. "prod"). Empty = all SSH profiles.', required: false },
      ],
      handler: async (args = {}) => {
        const command = args.command || '<COMMAND>';
        const target = args.target || '<all SSH profiles>';
        return {
          description: '批量升级 Batch upgrade',
          messages: [
            userMessage(
              [
                `Run a batch upgrade（批量升级）: command \`${command}\` on ${target}.`,
                '',
                '1. Call `yaet_profiles` and list the candidate target profiles (apply the prefix filter if one was given).',
                '2. Show me the exact host list and the exact command, and WAIT for my explicit confirmation before executing anything.',
                '3. After confirmation, run `ssh_execute` per profile SEQUENTIALLY (never in parallel — apt/dnf locks and interleaved sudo prompts break).',
                '4. For hosts needing privilege escalation, prefer `ssh_sudo_execute` over embedding passwords in the command.',
                '5. Summarize per host: OK / FAILED (with the tail of stderr), and stop the rollout on the first failure unless I say otherwise.',
                '',
                'Never print passwords or private keys. Never chain hosts with unreviewed shell metacharacters in the command.',
              ].join('\n'),
            ),
          ],
        };
      },
    },
  ];
}

module.exports = { createPrompts };
