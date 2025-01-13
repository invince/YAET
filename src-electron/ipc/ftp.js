const { ipcMain } = require('electron');
const ftp = require('basic-ftp');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const { Writable , Readable} = require('stream');

function initFtpHandler(log, ftpMap, expressApp) {

  ipcMain.handle('session.fe.ftp.register', async (event, { id, config }) => {
    ftpMap.set(id, config);
  });

  //==================== API ==========================================================

  expressApp.post('/api/v1/ftp/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';

    const configId = req.params['id'];
    const config = ftpMap.get(configId);
    if (!config) {
      res.status(400).send({ error: { code: 400, message: 'Error connection config not found' } });
      return;
    }

    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging for debugging

    try {
      await client.access(config);

      switch (action) {
        case 'read': {

          res.json({ cwd: { name: pathParam, type: 'folder' }, files: await list(client, pathParam) });
          break;
        }
        case 'search': {
          const files = await client.list(pathParam);

          const regexFlags = req.body.caseSensitive ? '' : 'i';
          const searchRegex = new RegExp(req.body.searchString.replace(/\*/g, '.*'), regexFlags);

          const formattedFiles = [];
          for (const item of files) {
            const isHidden = item.name.startsWith('.');
            if (!req.body.showHiddenItems && isHidden) continue;

            if (searchRegex.test(item.name)) {
              formattedFiles.push({
                name: item.name,
                type: item.isDirectory ? 'folder' : 'file',
                size: item.size,
                modifyTime: item.modifiedAt,
              });
            }
          }

          res.json({ cwd: { name: pathParam, type: 'folder' }, files: formattedFiles });
          break;
        }
        case 'delete': {
          const data = req.body.data || [];
          const details = [];
          for (let i = 0; i < data.length; i++) {
            const oneData = data[i];
            const name = oneData.name;
            const fileAbsPath = `${pathParam}${name}`;
            details.push(await list(client, pathParam, [name]));
            if (oneData.type === 'folder') {
              await client.removeDir(fileAbsPath);
            } else {
              await client.remove(fileAbsPath);
            }
          }
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: details });
          break;
        }
        case 'rename': {
          const name = req.body.name;
          const newName = req.body.newName;
          await client.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: await list(client, pathParam) });
          break;
        }
        case 'create': { // for now only mkdir is possible
          const name = req.body.name;
          const newFolderPath = `${pathParam}${name}`;
          if (await exists(client, newFolderPath)) {
            res.json({ cwd: { name: pathParam, type: 'folder' }, error: { code: 416, message: 'folder already exists' } });
          } else {
            // Create the folder
            await client.ensureDir(newFolderPath);

            res.json({ cwd: { name: pathParam, type: 'folder' }, files: await list(client, newFolderPath) });
          }
          break;
        }
        case 'details': {
          const names = req.body.names || [];
          res.json({ cwd: { name: pathParam, type: 'folder' }, details: await list(client, pathParam) });
          break;
        }
      }
    } catch (error) {
      log.error('Error handling FTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    } finally {
      client.close();
    }
  });

  // File Upload
  expressApp.post('/api/v1/ftp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data } = req.body;
    const path = JSON.parse(data).name; // path is incorrect on req.body
    const configId = req.params['id'];
    const config = ftpMap.get(configId);
    if (!config) {
      log.error('Error connection config not found');
      res.status(400).send({ error: { code: 400, message: 'Error connection config not found' } });
      return;
    }
    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging for debugging

    try {
      await client.access(config);

      // Upload the file
      const remotePath = await avoidDuplicateName(client, `${path}/${req.file.originalname}`);

      // Convert the file buffer to a readable stream
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer); // Add the buffer to the stream
      bufferStream.push(null); // Signal the end of the stream

      await client.uploadFrom(bufferStream, remotePath);

      res.json({ success: true, message: `File uploaded to ${remotePath}` });
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    } finally {
      client.close();
    }
  });

  // File Download
  expressApp.post('/api/v1/ftp/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const path = downloadInput.path;
    const names = downloadInput.names; // Assuming a single file download

    const configId = req.params['id'];
    const config = ftpMap.get(configId);
    if (!config) {
      log.error('Error connection config not found');
      res.status(400).send({ error: { code: 400, message: 'Error connection config not found' } });
      return;
    }

    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging for debugging

    try {
      await client.access(config);

      if (names.length === 1) {
        const fullPath = path + names[0];

        // Create a writable stream to collect the file data
        const chunks = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
          },
        });

        // Download the file to the writable stream
        await client.downloadTo(writableStream, fullPath);

        // Convert the chunks to a Buffer
        const buffer = Buffer.concat(chunks);

        res.set('Content-Disposition', `attachment; filename=${names[0]}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');

        // Create a new ZIP file instance
        const zipfile = new yazl.ZipFile();

        for (const name of names) {
          const fullPath = `${path}${name}`;

          try {
            // Create a writable stream to collect the file data
            const chunks = [];
            const writableStream = new Writable({
              write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
              },
            });

            // Download the file to the writable stream
            await client.downloadTo(writableStream, fullPath);

            // Convert the chunks to a Buffer
            const buffer = Buffer.concat(chunks);

            // Add the buffer to the ZIP file
            zipfile.addBuffer(buffer, name);
          } catch (fileError) {
            log.error(`Error fetching file ${fullPath}:`, fileError.message);
          }
        }

        // Finalize the ZIP and pipe it to the response
        zipfile.outputStream.pipe(res).on('close', () => {
          log.info('ZIP file successfully sent.');
        });
        zipfile.end();
      }
    } catch (error) {
      log.error('Error downloading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error downloading file: ' + error.message } });
    } finally {
      client.close();
    }
  });

  //================= Utils =================================================
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
      targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
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
}

module.exports = { initFtpHandler };
