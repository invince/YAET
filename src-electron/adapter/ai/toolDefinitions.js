const fs = require('fs');
const path = require('path');

function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'profile_list',
        description: 'Search available connection profiles. Returns id, name, type, host for matching profiles.',
        parameters: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: 'Optional keyword to filter by name or host' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'terminal_execute',
        description: 'Execute a command on a remote server (SSH/Telnet/WinRM) using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            command: { type: 'string', description: 'Command to execute on the remote server' },
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
          },
          required: ['profileId', 'command'],
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
        description: 'Read a remote file content via SFTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            localPath: { type: 'string', description: 'Optional local file path to save the download to (e.g. /home/user/file.zip or C:\\Users\\me\\file.pdf)' },
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
        description: 'Read a remote file content via FTP using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
            localPath: { type: 'string', description: 'Optional local file path to save to' },
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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
        description: 'Read a remote file content via Samba/SMB using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            path: { type: 'string', description: 'Remote file path' },
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
            localPath: { type: 'string', description: 'Optional local file path to save to' },
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
        description: 'Open a persistent terminal session for AI interaction. The session stays connected and can be used with session_write/session_read.',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use. Omit for local terminal.' },
            proxyId: { type: 'string', description: 'Optional proxy ID to route the connection through' },
            secretId: { type: 'string', description: 'Optional secret ID override for authentication' },
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

async function executeTool(runtime, toolName, args) {
  const opts = { proxyId: args.proxyId, secretId: args.secretId };

  switch (toolName) {
    case 'profile_list':
      return runtime.listProfiles(args.keyword);
    case 'terminal_execute':
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
      return { content: buf.toString('utf-8') };
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
    case 'session_list':
      return runtime.sessionRegistry.list();
    case 'session_read':
      return runtime.sessionRegistry.read(args.id, args.lastN);
    case 'terminal_open': {
      const session = await runtime.getConnector(args.profileId, opts);
      await session.connect({ rows: 24, cols: 80 });
      const sessionId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const profileType = args.profileId
        ? ((await runtime.listProfiles()).profiles.find(p => p.id === args.profileId)?.type || 'remote').toLowerCase()
        : 'local';
      const typeMap = { ssh_terminal: 'ssh', telnet_terminal: 'telnet', win_rm_terminal: 'winrm', local_terminal: 'local' };
      runtime.sessionRegistry.register(sessionId, typeMap[profileType] || profileType, 'ai', session);
      return { sessionId, type: typeMap[profileType] || profileType, message: `Session ${sessionId} opened` };
    }
    case 'session_write': {
      const entry = runtime.sessionRegistry.get(args.id);
      if (!entry) throw new Error(`Session not found: ${args.id}`);
      if (entry.owner !== 'ai') throw new Error(`Cannot write to session ${args.id}: not AI-owned (owner: ${entry.owner})`);
      const isRunning = entry.session._connected !== undefined ? entry.session._connected : true;
      if (!isRunning) throw new Error(`Session ${args.id} is no longer running`);
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
      if (args.localPath) {
        const dir = path.dirname(args.localPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(args.localPath, buffer);
        return { savedTo: path.resolve(args.localPath), size: buffer.length };
      }
      return { content: buffer.toString('base64'), encoding: 'base64', filename };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

module.exports = { getToolDefinitions, executeTool };