const { ipcMain, shell } = require('electron');
const SftpClient = require('ssh2-sftp-client');
const multer = require('multer');
const upload = multer();
const path = require('path');
const _ = require('lodash');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const { Readable } = require('stream');
const { createProxyConnection } = require('../../utils/proxyUtils');


function initScpSftpHandler(log, scpMap, expressApp, getProxies, getSecrets) {

  ipcMain.handle('session.fe.scp.register', async (event, { id, config }) => {
    scpMap.set(id, config);
  });

  //==================== Utils =================================================
  async function withSftpClient(configId, callback) {
    const configData = scpMap.get(configId);
    if (!configData) {
      throw new Error('Error connection config not found');
    }

    const config = configData.config;
    const proxyId = configData.proxyId;

    // Handle proxy if configured
    if (proxyId) {
      try {
        log.info(`SCP connection ${configId}: Using proxy ${proxyId}`);
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === proxyId);
          if (proxy) {
            log.info(`SCP connection ${configId}: Found proxy ${proxy.name} (type: ${proxy.type})`);
            // Create proxy connection to SSH server
            const sock = await createProxyConnection(
              proxy,
              config.host,
              config.port || 22,
              getSecrets,
              log
            );
            config.sock = sock;
            log.info(`SCP connection ${configId}: Proxy tunnel established`);
          } else {
            log.warn(`SCP connection ${configId}: Proxy ${proxyId} not found`);
          }
        }
      } catch (error) {
        log.error(`SCP connection ${configId}: Failed to establish proxy connection:`, error);
        throw error;
      }
    }

    const sftp = new SftpClient();
    try {
      await sftp.connect(config);
      return await callback(sftp);
    } finally {
      await sftp.end();
    }
  }

  async function avoidDuplicateName(sftp, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath)); // Extract file name without extension
      const fileExt = path.extname(filePath); // Extract extension
      const dir = path.dirname(filePath); // Extract directory path
      return { dir, fileName, fileExt };
    };

    const { dir, fileName, fileExt } = parseFilePath(targetFilePathOg);
    let index = 1; // Start indexing from 1 for suffix

    // Check if file exists and generate new target path
    while (await sftp.exists(targetFilePath)) {
      targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      index++;
    }
    return targetFilePath;
  }

  async function list(sftp, pathParam, names = undefined) {
    let files = await sftp.list(pathParam);
    if (names) {
      files = files.filter((file) => names.includes(file.name));
    }
    return files.map(file => ({
      name: file.name,
      type: file.type === 'd' ? 'folder' : 'file',
      isFile: file.type !== 'd',
      size: file.size,
      dateModified: file.modifyTime,
    }));
  }

  async function copyDirectory(sftp, sourcePath, targetPath) {
    await sftp.mkdir(targetPath, true); // Create target directory if it doesn't exist
    const items = await sftp.list(sourcePath);

    for (const item of items) {
      const sourceItemPath = `${sourcePath}/${item.name}`;
      const targetItemPath = `${targetPath}/${item.name}`;

      if (item.type === 'd') {
        // Recursively copy subdirectory
        await copyDirectory(sftp, sourceItemPath, targetItemPath);
      } else {
        // Copy file
        await sftp.rcopy(sourceItemPath, targetItemPath);
      }
    }
  }


  //==================== API ==========================================================
  expressApp.post('/api/v1/scp/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';
    const configId = req.params['id'];

    try {
      const result = await withSftpClient(configId, async (sftp) => {
        switch (action) {
          case 'read': {

            return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, pathParam) };
          }
          case 'search': {
            const files = await sftp.list(pathParam);
            const regexFlags = req.body.caseSensitive ? '' : 'i';
            // Safely escape all regex meta-characters, then convert * (escaped as \*) into .*
            const escapedSearchString = _.escapeRegExp(req.body.searchString).replace(/\\\*/g, '.*');
            const searchRegex = new RegExp(escapedSearchString, regexFlags);
            const formattedFiles = files.filter(item => {
              const isHidden = item.name.startsWith('.');
              return (req.body.showHiddenItems || !isHidden) && searchRegex.test(item.name);
            }).map(item => ({
              name: item.name,
              type: item.type === '-' ? 'file' : 'folder',
              size: item.size,
              modifyTime: item.modifyTime,
              accessTime: item.accessTime,
            }));

            return { cwd: { name: pathParam, type: 'folder' }, files: formattedFiles };
          }
          case 'delete': {
            const data = req.body.data || [];
            for (const oneData of data) {
              const fileAbsPath = `${pathParam}${oneData.name}`;
              if (oneData.type === 'folder') {
                await sftp.rmdir(fileAbsPath, true);
              } else {
                await sftp.delete(fileAbsPath);
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, pathParam) };
          }
          case 'rename': {
            const name = req.body.name;
            const newName = req.body.newName;
            await sftp.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, pathParam) };
          }
          case 'copy': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            for (const name of names) {
              const sourceFilePath = `${pathParam}${name}`;
              const targetFilePath = await avoidDuplicateName(sftp, `${targetPath}${name}`);
              const stats = await sftp.stat(sourceFilePath);
              if (stats.isDirectory) {
                // Recursively copy the directory
                await copyDirectory(sftp, sourceFilePath, targetFilePath);
              } else {
                await sftp.rcopy(sourceFilePath, targetFilePath);
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, targetPath, names) };
          }
          case 'move': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            if (targetPath !== pathParam) {
              for (const name of names) {
                const sourceFilePath = `${pathParam}${name}`;
                const targetFilePath = await avoidDuplicateName(sftp, `${targetPath}${name}`);
                const stats = await sftp.stat(sourceFilePath);
                if (stats.isDirectory) {
                  // Recursively move the directory
                  await copyDirectory(sftp, sourceFilePath, targetFilePath);
                  await sftp.rmdir(sourceFilePath, true); // Remove source directory
                } else {
                  await sftp.rcopy(sourceFilePath, targetFilePath);
                  await sftp.delete(sourceFilePath);
                }
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, targetPath, names) };
          }
          case 'create': {
            const name = req.body.name;
            const newFolderPath = `${pathParam}${name}`;
            if (await sftp.exists(newFolderPath)) {
              return { cwd: { name: pathParam, type: 'folder' }, error: { code: 416, message: 'folder already exists' } };
            } else {
              await sftp.mkdir(newFolderPath, true);
              return { cwd: { name: pathParam, type: 'folder' }, files: await list(sftp, newFolderPath) };
            }
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });

      res.json(result);
    } catch (error) {
      log.error('Error handling SCP/SFTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/scp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    const path = JSON.parse(data).name;
    const configId = req.params['id'];

    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const result = await withSftpClient(configId, async (sftp) => {
        const remotePath = await avoidDuplicateName(sftp, `${path}/${filename}`);// the req.file.originalname may have encoding pb
        // Multer 2.0 changed req.file.buffer to req.file.data
        const fileData = req.file.data || req.file.buffer;
        await sftp.put(fileData, remotePath);
        return { success: true, message: `File uploaded to ${remotePath}` };
      });

      res.json(result);
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/scp/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const path = downloadInput.path;
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      await withSftpClient(configId, async (sftp) => {
        if (names.length === 1) {
          const fullRemotePath = path + names[0];
          const buffer = await sftp.get(fullRemotePath);
          const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
          res.set(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodedFilename}`
          );
          res.send(buffer);
        } else if (names.length > 1) {
          res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
          res.setHeader('Content-Type', 'application/zip');
          const zipfile = new yazl.ZipFile();
          for (const name of names) {
            const fullRemotePath = `${path}${name}`;
            try {
              const buffer = await sftp.get(fullRemotePath);
              zipfile.addBuffer(buffer, name);
            } catch (fileError) {
              log.error(`Error fetching file ${fullRemotePath}:`, fileError.message);
            }
          }
          zipfile.outputStream.pipe(res).on('close', () => {
            log.info('ZIP file successfully sent.');
          });
          zipfile.end();
        }
      });
    } catch (error) {
      log.error('Error downloading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error downloading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/scp/open/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const remotePath = downloadInput.path;
    const fileName = downloadInput.names[0]; // Assuming a single file
    const configId = req.params['id'];

    try {
      await withSftpClient(configId, async (sftp) => {
        const fullRemotePath = `${remotePath}${fileName}`;
        const tempDir = path.join(os.tmpdir(), 'scp-temp-files');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Generate a unique temporary file path
        const tempFilePath = path.join(tempDir, uuid.v4() + fileName);

        // Download the file from the SCP server
        await sftp.get(fullRemotePath, tempFilePath);

        // Open the file with the default system application
        const result = await shell.openPath(tempFilePath);
        if (result) {
          log.error(`Error opening file: ${result}`);
          res.status(500).send({ error: { code: 500, message: 'Error opening file' } });
          return;
        }

        // Watch the file for changes
        let watcher = fs.watch(tempFilePath, async (eventType) => {
          if (eventType === 'change') {
            log.info(`File modified: ${tempFilePath}`);

            await withSftpClient(configId, async (sftpUpdate) => {
              try {
                // Read the updated file into a buffer
                const updatedBuffer = await fsPromise.readFile(tempFilePath);

                // Convert the buffer into a readable stream
                const bufferStream = new Readable();
                bufferStream.push(updatedBuffer);
                bufferStream.push(null);

                // Re-upload the updated file to the SCP server
                await sftpUpdate.put(bufferStream, fullRemotePath);
                log.info(`File updated successfully: ${fullRemotePath}`);
              } catch (error) {
                log.error('Error uploading updated file:', error);
              }
            });
          }
        });

        // Clean up watcher and temporary file after a timeout (optional)
        setTimeout(async () => {
          watcher.close();
          try {
            await fsPromise.unlink(tempFilePath);
            log.info('Temporary file deleted:', tempFilePath);
          } catch (err) {
            log.error('Error deleting temporary file:', err);
          }
        }, 10 * 60 * 1000); // Stop watching after 10 minutes
      });
    } catch (error) {
      log.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });
}

module.exports = { initScpSftpHandler };
