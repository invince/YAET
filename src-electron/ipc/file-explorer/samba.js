const { ipcMain, shell } = require('electron');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const SMB2  = require('v9u-smb2');

function initSambaHandler(log, sambaMap, expressApp) {

  ipcMain.handle('session.fe.samba.register', async (event, { id, config }) => {
    sambaMap.set(id, config);
  });

  //==================== Utils =================================================
  async function withSambaClient(configId, callback) {
    const config = sambaMap.get(configId);
    if (!config) {
      throw new Error('Error: connection config not found');
    }

    if (!config.domain) {
      config.domain = 'WORKGROUP';
    }

    const smbClient = new SMB2(config);

    try {
      return await callback(smbClient);
    } finally {
      smbClient.disconnect();
    }
  }

  async function avoidDuplicateName(smbClient, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath));
      const fileExt = path.extname(filePath);
      const dir = path.dirname(filePath);
      return { dir, fileName, fileExt };
    };

    const { dir, fileName, fileExt } = parseFilePath(targetFilePathOg);
    let index = 1;

    while (await smbClient.exists(targetFilePath)) {
      targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      index++;
    }
    return targetFilePath;
  }

  async function list(smbClient, pathParam, names = undefined) {
    let files = await smbClient.readdir(pathParam, {stats: true});
    let formattedFiles = [];
    if (names) {
      files = files.filter((file) => names.includes(file.name));
    }
    if (files) {
      formattedFiles =  files.map((file) => ({
        name: file.name,
        type: file.isDirectory() ? 'folder' : 'file',
        isFile: !file.isDirectory(),
        size: file.size,
        dateModified: file.mtime,
      }));
    }
    return formattedFiles;
  }

  //==================== API ====================================================
  expressApp.post('/api/v1/samba/:id', async (req, res) => {
    const action = req.body.action || 'read';

    req.body.targetPath = fixPath(req.body.targetPath);
    req.body.path = fixPath(req.body.path);

    let pathParam = req.body.path;
    const configId = req.params['id'];

    try {
      const result = await withSambaClient(configId, async (smbClient) => {
        switch (action) {
          case 'read': {
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, pathParam)};
          }
          case 'delete': {
            const data = req.body.data || [];
            for (const oneData of data) {
              const fileAbsPath = path.join(pathParam, oneData.name);
              if (oneData.type === 'folder') {
                await smbClient.rmdir(fileAbsPath);
              } else {
                await smbClient.unlink(fileAbsPath);
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, pathParam)};
          }
          case 'rename': {
            const name = req.body.name;
            const newName = req.body.newName;
            await smbClient.rename(path.join(pathParam, name), path.join(pathParam, newName));
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, pathParam) };
          }
          case 'copy': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            for (const name of names) {
              const sourceFilePath = path.join(pathParam, name);
              const targetFilePath = await avoidDuplicateName(smbClient, path.join(targetPath, name));
              await copyPasteFile(smbClient, sourceFilePath, targetFilePath);
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, targetPath, names) };
          }
          case 'move': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            for (const name of names) {
              const sourceFilePath = path.join(pathParam, name);
              const targetFilePath = await avoidDuplicateName(smbClient, path.join(targetPath, name));
              await copyPasteFile(smbClient, sourceFilePath, targetFilePath);
              await smbClient.unlink(sourceFilePath);

            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, targetPath, names) };
          }
          case 'create': {
            const name = req.body.name;
            const newFolderPath = path.join(pathParam, name);
            if (await smbClient.exists(newFolderPath)) {
              return { cwd: { name: pathParam, type: 'folder' }, error: { code: 416, message: 'folder already exists' } };
            } else {
              await smbClient.mkdir(newFolderPath);
              return { cwd: { name: pathParam, type: 'folder' }, files: await list(smbClient, newFolderPath) };
            }
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });

      res.json(result);
    } catch (error) {
      log.error('Error handling Samba request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/samba/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data } = req.body;
    const targetDir = fixPath(JSON.parse(data).name);
    const configId = req.params['id'];

    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const result = await withSambaClient(configId, async (smbClient) => {
        const targetPath = await avoidDuplicateName(smbClient, path.join(targetDir, req.file.originalname));
        await smbClient.writeFile(targetPath, req.file.buffer);
        return { success: true, message: `File uploaded to ${targetPath}` };
      });

      res.json(result);
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/samba/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const directoryPath = fixPath(downloadInput.path);
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      await withSambaClient(configId, async (smbClient) => {
        if (names.length === 1) {
          const fullPath = path.join(directoryPath, names[0]);
          const fileBuffer = await smbClient.readFile(fullPath);
          // Encode the filename for the Content-Disposition header
          const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
          res.set(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodedFilename}`
          );
          res.send(fileBuffer);
        } else if (names.length > 1) {
          res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
          res.setHeader('Content-Type', 'application/zip');
          const zipfile = new yazl.ZipFile();

          for (const name of names) {
            const fullPath = path.join(directoryPath, name);
            try {
              const fileBuffer = await smbClient.readFile(fullPath);
              zipfile.addBuffer(fileBuffer, name);
            } catch (fileError) {
              log.error(`Error fetching file ${fullPath}:`, fileError.message);
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

  expressApp.post('/api/v1/samba/open/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const remotePath = fixPath(downloadInput.path);
    const fileName = downloadInput.names[0]; // Assuming a single file
    const configId = req.params['id'];

    try {
      await withSambaClient(configId, async (smbClient) => {
        const fullRemotePath = path.join(remotePath, fileName);
        const tempDir = path.join(os.tmpdir(), 'scp-temp-files');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Generate a unique temporary file path
        const tempFilePath = path.join(tempDir, uuid.v4() + fileName);
        const fileBuffer = await smbClient.readFile(fullRemotePath);
        await fsPromise.writeFile(tempFilePath, fileBuffer);

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

            await withSambaClient(configId, async (smbClientUpload) => {
              try {
                // Read the updated file into a buffer
                const updatedBuffer = await fsPromise.readFile(tempFilePath);

                await smbClientUpload.unlink(fullRemotePath); // FIXME she smbClient.writeFile should override the file, but it's not working
                // Re-upload the updated file to the samba server
                await smbClientUpload.writeFile(fullRemotePath, updatedBuffer);
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

  async function copyPasteFile(smbClient, sourcePath, destPath) {
    try {
      // Read the source file into a buffer
      const fileContent = await smbClient.readFile(sourcePath);
      log.info(`File read successfully: ${sourcePath}`);

      // Write the buffer content to the destination path
      await smbClient.writeFile(destPath, fileContent);
      log.info(`File written successfully to: ${destPath}`);
    } catch (error) {
      log.error('Error during copy-paste operation:', error);
      throw error;
    }
  }

  function fixPath(path) {
    let pathParam = path || '';
    if (pathParam.endsWith('/')) { // NOTE: adapt for ej2-filemanager
      pathParam = pathParam.slice(0, pathParam.length - 1);
    }
    if (pathParam.startsWith('/')) { // NOTE: adapt for ej2-filemanager
      pathParam = pathParam.slice(1);
    }
    return pathParam;
  }
}

module.exports = { initSambaHandler };
