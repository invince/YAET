const { ipcMain, shell } = require('electron');
const ftp = require('basic-ftp');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const { Writable, Readable } = require('stream');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');

function initFtpHandler(log, ftpMap, expressApp) {

  ipcMain.handle('session.fe.ftp.register', async (event, { id, config }) => {
    ftpMap.set(id, config);
  });

  //==================== Utils =================================================
  async function withFtpClient(configId, callback) {
    const config = ftpMap.get(configId);
    if (!config) {
      throw new Error('Error connection config not found');
    }

    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging for debugging

    try {
      await client.access(config);
      return await callback(client);
    } finally {
      client.close();
    }
  }

  async function avoidDuplicateName(client, targetFilePathOg) {
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
    while (await exists(client, targetFilePath)) {
      // Handle current directory case - avoid ./ prefix
      if (dir === '.') {
        targetFilePath = `${fileName}_${index}${fileExt}`;
      } else {
        targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      }
      index++;
    }
    return targetFilePath;
  }

  async function list(client, pathParam) {
    const files = await client.list(pathParam);

    return files.map(file => ({
      name: file.name,
      type: file.isDirectory ? 'folder' : 'file',
      isFile: !file.isDirectory,
      size: file.size,
      dateModified: file.modifiedAt,
    }));
  }

  async function exists(client, remoteFilePath) {
    const directoryPath = remoteFilePath.substring(0, remoteFilePath.lastIndexOf('/') + 1);
    const fileName = remoteFilePath.substring(remoteFilePath.lastIndexOf('/') + 1);

    try {
      // List files in the directory
      const files = await client.list(directoryPath);

      // Check if the file exists in the directory
      return files.some(file => file.name === fileName);
    } catch (error) {
      console.error('Error checking file existence:', error.message);
      return false;
    }
  }

  //==================== API ==========================================================
  expressApp.post('/api/v1/ftp/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';
    const configId = req.params['id'];

    try {
      const result = await withFtpClient(configId, async (client) => {
        switch (action) {
          case 'read':
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, pathParam) };
          case 'search': {
            const files = await client.list(pathParam);
            const regexFlags = req.body.caseSensitive ? '' : 'i';
            const searchRegex = new RegExp(req.body.searchString.replace(/\*/g, '.*'), regexFlags);

            const formattedFiles = files.filter(item => {
              const isHidden = item.name.startsWith('.');
              return (req.body.showHiddenItems || !isHidden) && searchRegex.test(item.name);
            }).map(item => ({
              name: item.name,
              type: item.isDirectory ? 'folder' : 'file',
              size: item.size,
              modifyTime: item.modifiedAt,
            }));

            return { cwd: { name: pathParam, type: 'folder' }, files: formattedFiles };
          }
          case 'delete': {
            const data = req.body.data || [];
            for (const oneData of data) {
              const fileAbsPath = `${pathParam}${oneData.name}`;
              if (oneData.type === 'folder') {
                await client.removeDir(fileAbsPath);
              } else {
                await client.remove(fileAbsPath);
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, pathParam) };
          }
          case 'rename': {
            const name = req.body.name;
            const newName = req.body.newName;
            await client.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, pathParam) };
          }
          case 'copy': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            for (const name of names) {
              const sourcePath = `${pathParam}${name}`;
              const targetPathWithName = await avoidDuplicateName(client, `${targetPath}${name}`);

              // Download from source
              const chunks = [];
              const writableStream = new Writable({
                write(chunk, encoding, callback) {
                  chunks.push(chunk);
                  callback();
                },
              });
              await client.downloadTo(writableStream, sourcePath);
              const buffer = Buffer.concat(chunks);

              // Upload to target
              const bufferStream = new Readable();
              bufferStream.push(buffer);
              bufferStream.push(null);
              await client.uploadFrom(bufferStream, targetPathWithName);
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, targetPath) };
          }
          case 'move': {
            const names = req.body.names || [];
            const targetPath = req.body.targetPath;
            for (const name of names) {
              const sourcePath = `${pathParam}${name}`;
              const targetPathWithName = await avoidDuplicateName(client, `${targetPath}${name}`);

              // Try to use rename first (more efficient if on same server)
              try {
                await client.rename(sourcePath, targetPathWithName);
              } catch (error) {
                // If rename fails, fall back to copy + delete
                log.info('Rename failed, using copy+delete:', error.message);

                // Download from source
                const chunks = [];
                const writableStream = new Writable({
                  write(chunk, encoding, callback) {
                    chunks.push(chunk);
                    callback();
                  },
                });
                await client.downloadTo(writableStream, sourcePath);
                const buffer = Buffer.concat(chunks);

                // Upload to target
                const bufferStream = new Readable();
                bufferStream.push(buffer);
                bufferStream.push(null);
                await client.uploadFrom(bufferStream, targetPathWithName);

                // Delete source
                await client.remove(sourcePath);
              }
            }
            return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, targetPath) };
          }
          case 'create': {
            const name = req.body.name;
            const newFolderPath = `${pathParam}${name}`;
            if (await exists(client, newFolderPath)) {
              return { cwd: { name: pathParam, type: 'folder' }, error: { code: 416, message: 'folder already exists' } };
            } else {
              await client.ensureDir(newFolderPath);
              return { cwd: { name: pathParam, type: 'folder' }, files: await list(client, newFolderPath) };
            }
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });

      res.json(result);
    } catch (error) {
      log.error('Error handling FTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/ftp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    const directoryPath = JSON.parse(data).name;
    const configId = req.params['id'];

    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const result = await withFtpClient(configId, async (client) => {
        const remotePath = await avoidDuplicateName(client, path.join(directoryPath, filename));// the req.file.originalname may have encoding pb
        const bufferStream = new Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null);
        await client.uploadFrom(bufferStream, remotePath);
        return { success: true, message: `File uploaded to ${remotePath}` };
      });

      res.json(result);
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/ftp/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const directoryPath = downloadInput.path;
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      await withFtpClient(configId, async (client) => {
        if (names.length === 1) {
          const fullPath = path.join(directoryPath, names[0]);
          const chunks = [];
          const writableStream = new Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            },
          });
          await client.downloadTo(writableStream, fullPath);
          const buffer = Buffer.concat(chunks);
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
            const fullRemotePath = path.join(directoryPath, name);
            try {
              const chunks = [];
              const writableStream = new Writable({
                write(chunk, encoding, callback) {
                  chunks.push(chunk);
                  callback();
                },
              });
              await client.downloadTo(writableStream, fullRemotePath);
              const buffer = Buffer.concat(chunks);
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

  expressApp.post('/api/v1/ftp/open/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const remotePath = downloadInput.path;
    const fileName = downloadInput.names[0];
    const configId = req.params['id'];

    try {
      await withFtpClient(configId, async (client) => {
        const fullRemotePath = remotePath + fileName;
        const tempDir = path.join(os.tmpdir(), 'ftp-temp-files');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const tempFilePath = path.join(tempDir, uuid.v4() + fileName);
        const writableStream = fs.createWriteStream(tempFilePath);
        await client.downloadTo(writableStream, fullRemotePath);

        writableStream.on('finish', () => {
          log.info(`File downloaded to ${tempFilePath}`);
          res.send({ message: 'File downloaded successfully', localFilePath: tempFilePath, fileName });
        });

        writableStream.on('error', (error) => {
          log.error('Error writing file locally:', error);
          res.status(500).send({ error: { code: 500, message: 'Error writing file locally' } });
        });

        const result = await shell.openPath(tempFilePath);
        if (result) {
          log.error(`Error opening file: ${result}`);
        }

        let watcher = fs.watch(tempFilePath, async (eventType) => {
          if (eventType === 'change') {
            log.info(`File modified: ${tempFilePath}`);
            await withFtpClient(configId, async (clientUpdate) => {
              const updatedBuffer = await fsPromise.readFile(tempFilePath);
              const bufferStream = new Readable();
              bufferStream.push(updatedBuffer);
              bufferStream.push(null);
              await clientUpdate.uploadFrom(bufferStream, fullRemotePath);
              log.info(`File updated successfully: ${fullRemotePath}`);
            });
          }
        });

        setTimeout(() => {
          watcher.close();
          fsPromise.unlink(tempFilePath)
            .then(() => log.info('Temporary file deleted:', tempFilePath))
            .catch((err) => log.info('Error deleting temp file:', err));
        }, 10 * 60 * 1000);
      });
    } catch (error) {
      log.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });
}

module.exports = { initFtpHandler };
