const { ipcMain, shell } = require('electron');
const { FtpFileExplorer } = require('../../../runtime/connectors/file/ftp');
const { createProxyConnection } = require('../../../utils/proxyUtils');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const { Readable } = require('stream');

function initFtpHandler(log, ftpMap, expressApp, proxyRepo, secretRepo) {

  function getExplorer(configId) {
    const exp = ftpMap.get(configId);
    if (!exp) throw new Error('Error connection config not found');
    return exp;
  }

  ipcMain.handle('session.fe.ftp.register', async (event, { id, config, proxyId }) => {
    let ftpConfig = { ...config };

    if (proxyId) {
      log.info(`FTP connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, ftpConfig.host, ftpConfig.port || 21, secretRepo, log);
          ftpConfig.sock = sock;
        }
      }
    }

    const explorer = new FtpFileExplorer(log, ftpConfig);
    ftpMap.set(id, explorer);
  });

  //==================== API ==========================================================
  expressApp.post('/api/v1/ftp/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);
      let result;

      switch (action) {
        case 'read': {
          const data = await explorer.listFiles(pathParam);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
          break;
        }
        case 'search': {
          const data = await explorer.search(pathParam, req.body.searchString, {
            caseSensitive: req.body.caseSensitive,
            showHiddenItems: req.body.showHiddenItems,
          });
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
          break;
        }
        case 'delete': {
          const data = await explorer.deleteFiles(pathParam, req.body.data || []);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
          break;
        }
        case 'rename': {
          const data = await explorer.renameFile(pathParam, req.body.name, req.body.newName);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
          break;
        }
        case 'copy': {
          const data = await explorer.copyFiles(pathParam, req.body.names || [], req.body.targetPath);
          result = { cwd: { name: req.body.targetPath, type: 'folder' }, files: data.files };
          break;
        }
        case 'move': {
          const data = await explorer.moveFiles(pathParam, req.body.names || [], req.body.targetPath);
          result = { cwd: { name: req.body.targetPath, type: 'folder' }, files: data.files };
          break;
        }
        case 'create': {
          const data = await explorer.createFolder(pathParam, req.body.name);
          result = {
            cwd: { name: pathParam + req.body.name, type: 'folder' },
            files: data.files,
            error: data.error,
          };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      res.json(result);
    } catch (error) {
      log.error('Error handling FTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/ftp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    let directoryPath;
    try {
      directoryPath = JSON.parse(data).name;
    } catch (error) {
      log.error('Error parsing upload data JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const configId = req.params['id'];

    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const explorer = getExplorer(configId);
      const remotePath = `${directoryPath}/${filename}`.replace(/\\/g, '/');
      let fileData = req.file.data || req.file.buffer;
      if (fileData && !(fileData instanceof Buffer)) {
        fileData = Buffer.from(fileData);
      }
      const { overwrite } = req.body;
      await explorer.uploadFile(remotePath, fileData, {
        overwrite: overwrite === 'true' || overwrite === true,
      });
      res.json({ success: true, message: `File uploaded to ${remotePath}` });
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/ftp/download/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      log.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const directoryPath = downloadInput.path;
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);

      if (names.length === 1) {
        const buffer = await explorer.downloadFile(path.join(directoryPath, names[0]));
        const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        const zipfile = new yazl.ZipFile();
        for (const name of names) {
          try {
            const fullRemotePath = path.join(directoryPath, name);
            const buffer = await explorer.downloadFile(fullRemotePath);
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
    } catch (error) {
      log.error('Error downloading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error downloading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/ftp/open/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      log.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const remotePath = downloadInput.path;
    const fileName = downloadInput.names[0];
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);
      const fullRemotePath = remotePath + fileName;
      const tempDir = path.join(os.tmpdir(), 'ftpHandler-temp-files');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const tempFilePath = path.join(tempDir, uuid.v4() + fileName);
      const buffer = await explorer.downloadFile(fullRemotePath);
      await fsPromise.writeFile(tempFilePath, buffer);

      const result = await shell.openPath(tempFilePath);
      if (result) {
        log.error(`Error opening file: ${result}`);
        res.status(500).send({ error: { code: 500, message: 'Error opening file' } });
        return;
      }

      let watcher = fs.watch(tempFilePath, async (eventType) => {
        if (eventType === 'change') {
          log.info(`File modified: ${tempFilePath}`);
          try {
            const updatedBuffer = await fsPromise.readFile(tempFilePath);
            const updateExplorer = getExplorer(configId);
            await updateExplorer.uploadFile(fullRemotePath, updatedBuffer);
            log.info(`File updated successfully: ${fullRemotePath}`);
          } catch (error) {
            log.error('Error uploading updated file:', error);
          }
        }
      });

      setTimeout(() => {
        watcher.close();
        fsPromise.unlink(tempFilePath)
          .then(() => log.info('Temporary file deleted:', tempFilePath))
          .catch((err) => log.info('Error deleting temp file:', err));
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      log.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });
}

module.exports = { initFtpHandler };
