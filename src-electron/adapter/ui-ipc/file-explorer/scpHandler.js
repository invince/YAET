const { ipcMain, shell } = require('electron');
const { ScpFileExplorer } = require('../../../runtime/connectors/file/scp');
const { RuntimeAPI } = require('../../../runtime/runtimeAPI');
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

function initScpSftpHandler(log, scpMap, expressApp, proxyRepo, secretRepo) {
  const runtime = new RuntimeAPI(log);
  runtime.setProxyRepo(proxyRepo);
  runtime.setSecretRepo(secretRepo);

  expressApp.post('/api/v1/scp/download', async (req, res) => {
    const { profileId, path, proxyId, secretId } = req.body;
    if (!profileId || !path) {
      return res.status(400).json({ error: 'profileId and path are required' });
    }
    try {
      const config = await runtime._resolveRemoteConfig(profileId, { proxyId, secretId });
      const explorer = new ScpFileExplorer(log, config);
      const buffer = await explorer.downloadFile(path);
      const filename = path.split('/').pop() || 'download';
      const encoded = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      res.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
      res.send(buffer);
    } catch (error) {
      log.error('SCP download error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  function getExplorer(configId) {
    const exp = scpMap.get(configId);
    if (!exp) throw new Error('Error connection config not found');
    return exp;
  }

  ipcMain.handle('session.fe.scp.register', async (event, { id, config, proxyId }) => {
    let sshConfig = { ...config };

    if (proxyId) {
      log.info(`SCP connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, sshConfig.host, sshConfig.port || 22, secretRepo, log);
          sshConfig.sock = sock;
        }
      }
    }

    const explorer = new ScpFileExplorer(log, sshConfig);
    scpMap.set(id, explorer);
  });

  expressApp.post('/api/v1/scp/:id', async (req, res) => {
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
      log.error('Error handling SCP/SFTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  expressApp.post('/api/v1/scp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    let targetDir;
    try {
      targetDir = JSON.parse(req.body.data).name;
    } catch (error) {
      log.error('Error parsing upload data JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const configId = req.params['id'];

    if (!req.file) {
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const explorer = getExplorer(configId);
      const { overwrite } = req.body;
      const fileData = req.file.data || req.file.buffer;
      const remotePath = `${targetDir}/${req.body.filename}`;
      await explorer.uploadFile(remotePath, fileData, {
        overwrite: overwrite === 'true' || overwrite === true,
      });
      res.json({ success: true, message: `File uploaded to ${remotePath}` });
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  expressApp.post('/api/v1/scp/download/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const p = downloadInput.path;
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);

      if (names.length === 1) {
        const buffer = await explorer.downloadFile(p + names[0]);
        const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        const zipfile = new yazl.ZipFile();
        for (const name of names) {
          try {
            const buffer = await explorer.downloadFile(`${p}${name}`);
            zipfile.addBuffer(buffer, name);
          } catch (fileError) {
            log.error(`Error fetching file ${p}${name}:`, fileError.message);
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

  expressApp.post('/api/v1/scp/open/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const remoteDir = downloadInput.path;
    const fileName = downloadInput.names[0];
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);
      const fullRemotePath = `${remoteDir}${fileName}`;
      const tempDir = path.join(os.tmpdir(), 'scp-temp-files');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

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
            const bufferStream = new Readable();
            bufferStream.push(updatedBuffer);
            bufferStream.push(null);

            const updateExplorer = getExplorer(configId);
            await updateExplorer.uploadFile(fullRemotePath, bufferStream);
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

module.exports = { initScpSftpHandler };
