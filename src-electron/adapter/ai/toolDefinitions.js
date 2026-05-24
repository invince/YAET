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
  ];
}

async function executeTool(runtime, toolName, args) {
  const opts = { proxyId: args.proxyId, secretId: args.secretId };

  switch (toolName) {
    case 'profile_list':
      return runtime.listProfiles(args.keyword);
    case 'terminal_execute': {
      const t = await runtime.getConnector(args.profileId, opts);
      return t.exec(args.command);
    }
    case 'scp_list_files': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.listFiles(args.path);
    }
    case 'scp_read_file': {
      const f = await runtime.getConnector(args.profileId, opts);
      const buffer = await f.readFile(args.path);
      return { content: buffer.toString('utf-8') };
    }
    case 'scp_write_file': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.writeFile(args.path, Buffer.from(args.content, 'utf-8'), { overwrite: true });
    }
    case 'scp_delete_files': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.deleteFiles(args.path, args.items);
    }
    case 'scp_rename_file': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.renameFile(args.path, args.name, args.newName);
    }
    case 'scp_copy_files': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.copyFiles(args.path, args.names, args.targetPath);
    }
    case 'scp_move_files': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.moveFiles(args.path, args.names, args.targetPath);
    }
    case 'scp_create_folder': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.createFolder(args.path, args.name);
    }
    case 'scp_search_files': {
      const f = await runtime.getConnector(args.profileId, opts);
      return f.search(args.path, args.searchString, {
        caseSensitive: args.caseSensitive,
        showHiddenItems: args.showHiddenItems,
      });
    }
    case 'scp_download_file': {
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
