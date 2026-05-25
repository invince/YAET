const { ipcMain, shell } = require('electron');
const { SambaFileExplorer } = require('../../../runtime/connectors/file/samba');
const { createProxyConnection } = require('../../../utils/proxyUtils');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');

function initSambaHandler(log, sambaMap, expressApp, proxyRepo, secretRepo) {

  function getExplorer(configId) {
    const exp = sambaMap.get(configId);
    if (!exp) throw new Error('Error: connection config not found');
    return exp;
  }

  ipcMain.handle('session.fe.samba.register', async (event, { id, config, proxyId }) => {
    let smbConfig = { ...config };

    if (proxyId) {
      log.info(`Samba connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, smbConfig.share, smbConfig.port || 445, secretRepo, log);
          smbConfig.sock = sock;
        }
      }
    }

    const explorer = new SambaFileExplorer(log, smbConfig);
    sambaMap.set(id, explorer);
  });

  function fixPath(pathParam) {
    let p = pathParam || '';
    if (p.endsWith('/')) p = p.slice(0, -1);
    if (p.startsWith('/')) p = p.slice(1);
    return p;
  }

  //==================== API ====================================================
  expressApp.post('/api/v1/samba/:id', async (req, res) => {
    const action = req.body.action || 'read';
    req.body.targetPath = fixPath(req.body.targetPath);
    req.body.path = fixPath(req.body.path);
    const pathParam = req.body.path;
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
          const names = req.body.names || [];
          const targetPath = req.body.targetPath;
          const data = await explorer.copyFiles(pathParam, names, targetPath);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
          break;
        }
        case 'move': {
          const names = req.body.names || [];
          const targetPath = req.body.targetPath;
          const data = await explorer.moveFiles(pathParam, names, targetPath);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data.files };
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
      log.error('Error handling Samba request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/samba/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    let targetDir;
    try {
      targetDir = fixPath(JSON.parse(data).name);
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
      const remotePath = path.join(targetDir, filename);
      const fileData = req.file.data || req.file.buffer;
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

  expressApp.post('/api/v1/samba/download/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      log.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const directoryPath = fixPath(downloadInput.path);
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);

      if (names.length === 1) {
        const fullPath = path.join(directoryPath, names[0]);
        const buffer = await explorer.downloadFile(fullPath);
        const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        const zipfile = new yazl.ZipFile();
        for (const name of names) {
          try {
            const fullPath = path.join(directoryPath, name);
            const buffer = await explorer.downloadFile(fullPath);
            zipfile.addBuffer(buffer, name);
          } catch (fileError) {
            log.error(`Error fetching file ${fullPath}:`, fileError.message);
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

  expressApp.post('/api/v1/samba/open/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      log.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const remotePath = fixPath(downloadInput.path);
    const fileName = downloadInput.names[0];
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);
      const fullRemotePath = path.join(remotePath, fileName);
      const tempDir = path.join(os.tmpdir(), 'samba-temp-files');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
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

      setTimeout(async () => {
        watcher.close();
        try {
          await fsPromise.unlink(tempFilePath);
          log.info('Temporary file deleted:', tempFilePath);
        } catch (err) {
          log.error('Error deleting temporary file:', err);
        }
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      log.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });
}

module.exports = { initSambaHandler };
