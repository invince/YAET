const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { isSessionAlive } = require('../../runtime/sessionRegistry');

function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'profile_list',
        description: 'Search available connection profiles. Returns only id, name and type — use the id with other tools via profileId. Hosts and all credentials stay in the main process and are never exposed.',
        parameters: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: 'Optional keyword to filter by profile name' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'local_execute',
        description: 'Execute a command on the local machine directly (no profile needed)',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute on the local machine' },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_list_files',
        description: 'List files in a remote directory via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote directory path' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_read_file',
        description: 'Read a remote text file via SFTP using a saved profile. Binary files are rejected (use *_download_file). Large files are truncated (see truncated/totalBytes).',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            maxBytes: { type: 'number', description: 'Max bytes to return (default 131072, clamped to 1024-1048576)' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_write_file',
        description: 'Write content to a remote file via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            content: { type: 'string', description: 'File content to write' },
          },
          required: ['profileId', 'path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_delete_files',
        description: 'Delete files or folders on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            items: {
              type: 'array',
              description: 'Array of items to delete, each with name and type (file/folder)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'File or folder name' },
                  type: { type: 'string', enum: ['file', 'folder'], description: 'Item type' },
                },
              },
            },
          },
          required: ['profileId', 'path', 'items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_rename_file',
        description: 'Rename a file or folder on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'Current file/folder name' },
            newName: { type: 'string', description: 'New file/folder name' },
          },
          required: ['profileId', 'path', 'name', 'newName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_copy_files',
        description: 'Copy files or folders on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to copy',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_move_files',
        description: 'Move files or folders on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to move',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_create_folder',
        description: 'Create a new folder on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'New folder name' },
          },
          required: ['profileId', 'path', 'name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_download_file',
        description: 'Download a remote file to local disk via SFTP. If localPath is provided, writes directly to that path and returns the local path. Otherwise returns base64 content.',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            localPath: { type: 'string', description: 'Optional local file path to save the download to. Must be inside the AI download directory (~/yaet-downloads/ by default, overridable via settings; relative names land there automatically).' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scp_search_files',
        description: 'Search for files on a remote server via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Directory path to search in' },
            searchString: { type: 'string', description: 'Search pattern (supports wildcards)' },
            caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default false)' },
            showHiddenItems: { type: 'boolean', description: 'Include hidden files in results (default false)' },
          },
          required: ['profileId', 'path', 'searchString'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_list_files',
        description: 'List files in a remote directory via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote directory path' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_read_file',
        description: 'Read a remote text file via FTP using a saved profile. Binary files are rejected (use *_download_file). Large files are truncated (see truncated/totalBytes).',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            maxBytes: { type: 'number', description: 'Max bytes to return (default 131072, clamped to 1024-1048576)' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_write_file',
        description: 'Write content to a remote file via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            content: { type: 'string', description: 'File content to write' },
          },
          required: ['profileId', 'path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_delete_files',
        description: 'Delete files or folders on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            items: {
              type: 'array',
              description: 'Array of items to delete, each with name and type (file/folder)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'File or folder name' },
                  type: { type: 'string', enum: ['file', 'folder'], description: 'Item type' },
                },
              },
            },
          },
          required: ['profileId', 'path', 'items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_rename_file',
        description: 'Rename a file or folder on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'Current file/folder name' },
            newName: { type: 'string', description: 'New file/folder name' },
          },
          required: ['profileId', 'path', 'name', 'newName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_copy_files',
        description: 'Copy files or folders on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to copy',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_move_files',
        description: 'Move files or folders on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to move',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_create_folder',
        description: 'Create a new folder on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'New folder name' },
          },
          required: ['profileId', 'path', 'name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_download_file',
        description: 'Download a remote file to local disk via FTP. If localPath is provided, writes directly to that path. Otherwise returns base64 content.',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            localPath: { type: 'string', description: 'Optional local file path to save to. Must be inside the AI download directory (~/yaet-downloads/ by default).' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ftp_search_files',
        description: 'Search for files on a remote server via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Directory path to search in' },
            searchString: { type: 'string', description: 'Search pattern (supports wildcards)' },
            caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default false)' },
            showHiddenItems: { type: 'boolean', description: 'Include hidden files in results (default false)' },
          },
          required: ['profileId', 'path', 'searchString'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_list_files',
        description: 'List files in a remote directory via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote directory path' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_read_file',
        description: 'Read a remote text file via Samba/SMB using a saved profile. Binary files are rejected (use *_download_file). Large files are truncated (see truncated/totalBytes).',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            maxBytes: { type: 'number', description: 'Max bytes to return (default 131072, clamped to 1024-1048576)' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_write_file',
        description: 'Write content to a remote file via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            content: { type: 'string', description: 'File content to write' },
          },
          required: ['profileId', 'path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_delete_files',
        description: 'Delete files or folders on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            items: {
              type: 'array',
              description: 'Array of items to delete, each with name and type (file/folder)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'File or folder name' },
                  type: { type: 'string', enum: ['file', 'folder'], description: 'Item type' },
                },
              },
            },
          },
          required: ['profileId', 'path', 'items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_rename_file',
        description: 'Rename a file or folder on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'Current file/folder name' },
            newName: { type: 'string', description: 'New file/folder name' },
          },
          required: ['profileId', 'path', 'name', 'newName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_copy_files',
        description: 'Copy files or folders on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to copy',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_move_files',
        description: 'Move files or folders on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Source directory path' },
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file/folder names to move',
            },
            targetPath: { type: 'string', description: 'Target directory path' },
          },
          required: ['profileId', 'path', 'names', 'targetPath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_create_folder',
        description: 'Create a new folder on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Parent directory path' },
            name: { type: 'string', description: 'New folder name' },
          },
          required: ['profileId', 'path', 'name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_download_file',
        description: 'Download a remote file to local disk via Samba/SMB. If localPath is provided, writes directly to that path. Otherwise returns base64 content.',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
            localPath: { type: 'string', description: 'Optional local file path to save to. Must be inside the AI download directory (~/yaet-downloads/ by default).' },
          },
          required: ['profileId', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'session_list',
        description: 'List all active terminal sessions (SSH, Local, Telnet, WinRM, VNC) visible to the AI',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'session_read',
        description: 'Read recent output from a terminal session by session ID. Returns the buffered output lines.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Session ID (from session_list)' },
            lastN: { type: 'number', description: 'Optional number of recent output lines to read (default: use maxBufferLines setting)' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'terminal_open',
        description: 'Open a persistent terminal session for AI interaction (SSH/Telnet/WinRM/Serial/local only). The session stays connected and can be used with session_write/session_read. File-explorer profiles cannot be opened — use scp_*/local_execute instead.',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use. Omit for local terminal.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'session_write',
        description: 'Send input to an AI-owned terminal session. Only works on sessions created by terminal_open.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Session ID (must be AI-owned, from session_list)' },
            input: { type: 'string', description: 'Input to send to the session (e.g. a shell command)' },
          },
          required: ['id', 'input'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'samba_search_files',
        description: 'Search for files on a remote server via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Directory path to search in' },
            searchString: { type: 'string', description: 'Search pattern (supports wildcards)' },
            caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default false)' },
            showHiddenItems: { type: 'boolean', description: 'Include hidden files in results (default false)' },
          },
          required: ['profileId', 'path', 'searchString'],
        },
      },
    },
  ];
}

const SENSITIVE_TOOLS = ['local_execute', 'session_write', 'terminal_open'];

// P0-2: file-mutating tools always go through the approval gate (auto mode
// prompts for them, see ApprovalManager._isDangerous). Read-only tools
// (profile_list, *_list_files, *_read_file, *_search_files, session_*) don't.
const DESTRUCTIVE_FILE_TOOL_SUFFIX = /_(write_file|delete_files|rename_file|copy_files|move_files|create_folder|download_file)$/;

function needsApproval(toolName) {
  return SENSITIVE_TOOLS.includes(toolName) || DESTRUCTIVE_FILE_TOOL_SUFFIX.test(toolName || '');
}

// P0-3: AI-driven downloads may only touch the download directory (overridable
// via settings.ai.downloadDir). Default is ~/yaet-downloads: visible so users
// can find the files, always creatable (~/Downloads is NOT guaranteed —
// headless servers, containers, localized Windows folder names), and
// app-namespaced so it doesn't pollute anything else.
const AI_DOWNLOAD_DIR_DEFAULT = path.join(os.homedir(), 'yaet-downloads');

// Inline base64 return is capped so a multi-GB file can't blow up the LLM
// context; oversized files must be saved via localPath instead.
const AI_DOWNLOAD_INLINE_MAX_BYTES = 512 * 1024;

function expandHome(p) {
  const s = String(p || '');
  return s.startsWith('~/') ? path.join(os.homedir(), s.slice(2)) : s;
}

function downloadBaseDir(sessionContext) {
  return expandHome(sessionContext?.downloadDir || AI_DOWNLOAD_DIR_DEFAULT);
}

function resolveSandboxedPath(localPath, baseDir) {
  const base = expandHome(baseDir || AI_DOWNLOAD_DIR_DEFAULT);
  let p = String(localPath || '');
  if (p.startsWith('~/')) p = path.join(os.homedir(), p.slice(2));
  const abs = path.isAbsolute(p) ? path.normalize(p) : path.join(base, p);
  const resolved = path.resolve(abs);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`localPath outside allowed directory (${base}): ${localPath}`);
  }
  return resolved;
}

// P1-3: text-file reads are capped so a huge log can't blow up the LLM
// context. Binary (NUL byte) is rejected outright — use *_download_file.
const AI_READ_DEFAULT_MAX_BYTES = 128 * 1024;
const AI_READ_MIN_MAX_BYTES = 1024;
const AI_READ_HARD_MAX_BYTES = 1024 * 1024;

function clampReadMaxBytes(v) {
  const n = Number(v) || AI_READ_DEFAULT_MAX_BYTES;
  return Math.min(AI_READ_HARD_MAX_BYTES, Math.max(AI_READ_MIN_MAX_BYTES, n));
}

async function executeTool(runtime, toolName, args, sessionContext = {}) {
  if (needsApproval(toolName) && runtime?.approvalManager) {
    const result = await runtime.approvalManager.request(toolName, args);
    if (!result.approved) {
      return { error: `Command rejected: ${result.reason}` };
    }
  }

  // P0-1: AI must NOT override secrets/proxy. Credentials resolve only from
  // the profile-bound secretId (connProfile) and proxyId (profile.proxyId)
  // inside runtimeAPI._resolveRemoteConfig. Any AI-passed IDs are ignored.
  const opts = {};

  switch (toolName) {
    case 'profile_list':
      return runtime.listProfiles(args.keyword);
    case 'local_execute': {
      const t = await runtime.getConnector(args.profileId, opts);
      return t.exec(args.command);
    }

    case 'scp_list_files':
    case 'ftp_list_files':
    case 'samba_list_files': {
      return (await runtime.getConnector(args.profileId, opts)).listFiles(args.path);
    }
    case 'scp_read_file':
    case 'ftp_read_file':
    case 'samba_read_file': {
      const buf = await (await runtime.getConnector(args.profileId, opts)).readFile(args.path);
      // P1-3: NUL byte = binary (so/jpg/zip/db). Never return mojibake —
      // point the agent at *_download_file instead.
      if (buf.includes(0)) {
        throw new Error(`'${args.path}' looks binary (${buf.length} bytes). Use *_download_file with localPath to fetch it.`);
      }
      const cap = clampReadMaxBytes(args.maxBytes);
      if (buf.length > cap) {
        return {
          content: buf.subarray(0, cap).toString('utf-8'),
          truncated: true,
          totalBytes: buf.length,
          hint: `Output truncated to ${cap} bytes. Use *_download_file with localPath, then read it back in chunks via local_execute.`,
        };
      }
      return { content: buf.toString('utf-8'), truncated: false, totalBytes: buf.length };
    }
    case 'scp_write_file':
    case 'ftp_write_file':
    case 'samba_write_file': {
      return (await runtime.getConnector(args.profileId, opts)).writeFile(
        args.path, Buffer.from(args.content, 'utf-8'), { overwrite: true });
    }
    case 'scp_delete_files':
    case 'ftp_delete_files':
    case 'samba_delete_files': {
      return (await runtime.getConnector(args.profileId, opts)).deleteFiles(args.path, args.items);
    }
    case 'scp_rename_file':
    case 'ftp_rename_file':
    case 'samba_rename_file': {
      return (await runtime.getConnector(args.profileId, opts)).renameFile(args.path, args.name, args.newName);
    }
    case 'scp_copy_files':
    case 'ftp_copy_files':
    case 'samba_copy_files': {
      return (await runtime.getConnector(args.profileId, opts)).copyFiles(args.path, args.names, args.targetPath);
    }
    case 'scp_move_files':
    case 'ftp_move_files':
    case 'samba_move_files': {
      return (await runtime.getConnector(args.profileId, opts)).moveFiles(args.path, args.names, args.targetPath);
    }
    case 'scp_create_folder':
    case 'ftp_create_folder':
    case 'samba_create_folder': {
      return (await runtime.getConnector(args.profileId, opts)).createFolder(args.path, args.name);
    }
    case 'scp_search_files':
    case 'ftp_search_files':
    case 'samba_search_files': {
      return (await runtime.getConnector(args.profileId, opts)).search(args.path, args.searchString, {
        caseSensitive: args.caseSensitive,
        showHiddenItems: args.showHiddenItems,
      });
    }
    case 'session_list': {
      if (!sessionContext.useContext) return [];
      const sessions = runtime.sessionRegistry.list();
      if (sessionContext.crossSessionAccess) {
        return sessions.filter(s => s.owner === 'ai');
      }
      return sessions.filter(s => s.owner === 'ai' && s.chatSessionId === sessionContext.chatSessionId);
    }
    case 'session_read': {
      const entry = runtime.sessionRegistry.get(args.id);
      if (!entry) return null;
      if (sessionContext.crossSessionAccess === false && entry.owner !== 'ai') {
        throw new Error(`Access denied: session ${args.id} is not accessible`);
      }
      if (sessionContext.crossSessionAccess === false && entry.owner === 'ai' && sessionContext.chatSessionId && entry.chatSessionId !== sessionContext.chatSessionId) {
        throw new Error(`Access denied: session ${args.id} belongs to a different chat`);
      }
      return runtime.sessionRegistry.read(args.id, args.lastN);
    }
    case 'terminal_open': {
      // P1-4: only terminal-kind profiles hold a live channel. File-explorer
      // connectors are stateless (connect per op) and have no connect() —
      // reject with a useful error instead of `connect is not a function`.
      const TERMINAL_TYPES = new Set(['SSH_TERMINAL', 'TELNET_TERMINAL', 'WIN_RM_TERMINAL', 'SERIAL_TERMINAL', 'LOCAL_TERMINAL']);
      const profileTypeRaw = args.profileId
        ? ((await runtime.listProfiles()).profiles.find(p => p.id === args.profileId)?.type || '')
        : 'LOCAL_TERMINAL';
      if (profileTypeRaw && !TERMINAL_TYPES.has(profileTypeRaw)) {
        throw new Error(`Profile type ${profileTypeRaw} cannot hold a persistent session. Use scp_*/ftp_*/samba_* one-shot tools or local_execute instead.`);
      }
      const session = await runtime.getConnector(args.profileId, opts);
      await session.connect({ rows: 24, cols: 80 });
      const sessionId = `ai_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const profileType = (profileTypeRaw || 'remote').toLowerCase();
      const typeMap = { ssh_terminal: 'ssh', telnet_terminal: 'telnet', win_rm_terminal: 'winrm', serial_terminal: 'serial', local_terminal: 'local' };
      runtime.sessionRegistry.register(sessionId, typeMap[profileType] || profileType, 'ai', session, sessionContext.chatSessionId);
      return { sessionId, type: typeMap[profileType] || profileType, message: `Session ${sessionId} opened` };
    }
    case 'session_write': {
      const entry = runtime.sessionRegistry.get(args.id);
      if (!entry) throw new Error(`Session not found: ${args.id}`);
      if (entry.owner !== 'ai') throw new Error(`Cannot write to session ${args.id}: not AI-owned (owner: ${entry.owner})`);
      // P1-4: shared probe (method → _connected → true), no ad-hoc ternary.
      if (!isSessionAlive(entry.session)) throw new Error(`Session ${args.id} is no longer running`);
      const data = args.input.endsWith('\n') ? args.input : args.input + '\n';
      await entry.session.write(data);
      return { success: true, sessionId: args.id };
    }
    case 'scp_download_file':
    case 'ftp_download_file':
    case 'samba_download_file': {
      const f = await runtime.getConnector(args.profileId, opts);
      const buffer = await f.downloadFile(args.path);
      const filename = args.path.split('/').pop() || args.path;
      const dlBase = downloadBaseDir(sessionContext);
      if (args.localPath) {
        const target = resolveSandboxedPath(args.localPath, dlBase);
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, buffer);
        return { savedTo: target, size: buffer.length };
      }
      if (buffer.length > AI_DOWNLOAD_INLINE_MAX_BYTES) {
        throw new Error(`File too large for inline return (${buffer.length} bytes > ${AI_DOWNLOAD_INLINE_MAX_BYTES}). Retry with localPath inside ${dlBase} to save it to disk.`);
      }
      return { content: buffer.toString('base64'), encoding: 'base64', filename };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

module.exports = { getToolDefinitions, executeTool };