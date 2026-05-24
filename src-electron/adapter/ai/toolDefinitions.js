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
        name: 'ssh_execute',
        description: 'Execute a command on a remote server via SSH using a saved profile',
        parameters: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile to use' },
            command: { type: 'string', description: 'Command to execute on the remote server' },
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
          },
          required: ['profileId', 'path', 'content'],
        },
      },
    },
  ];
}

async function executeTool(runtime, toolName, args) {
  switch (toolName) {
    case 'profile_list':
      return runtime.listProfiles(args.keyword);
    case 'ssh_execute': {
      const t = await runtime.getConnector(args.profileId);
      return t.exec(args.command);
    }
    case 'scp_list_files': {
      const f = await runtime.getConnector(args.profileId);
      return f.listFiles(args.path);
    }
    case 'scp_read_file': {
      const f = await runtime.getConnector(args.profileId);
      return f.readFile(args.path);
    }
    case 'scp_write_file': {
      const f = await runtime.getConnector(args.profileId);
      return f.writeFile(args.path, args.content);
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

module.exports = { getToolDefinitions, executeTool };
