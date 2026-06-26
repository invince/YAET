/**
 * SCP/SFTP File Explorer Plugin — Backend Entry
 *
 * Registers IPC handlers and Express routes for SCP/SFTP file operations.
 * Migrated from src-electron/adapter/ipc/file-explorer/scpHandler.js
 */
const { ipcMain, shell } = require('electron');
const { ScpFileExplorer } = require('./scp');
const { RuntimeAPI } = require('../../../src-electron/runtime/runtimeAPI');
const { createProxyConnection } = require('../../../src-electron/utils/proxyUtils');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const { Readable } = require('stream');
const { generalLimiter, uploadLimiter, downloadLimiter, openLimiter } = require('../../../src-electron/adapter/ipc/rateLimiter');

/** Module-level connection map (managed internally, not exposed to electronMain) */
const scpMap = new Map();

function register(context) {
  const logger = context.logger;
  const expressAppGetter = typeof context.expressApp === 'function'
    ? () => context.expressApp()
    : () => context.expressApp;
  const proxyRepo = typeof context.proxyService === 'function'
    ? context.proxyService
    : () => context.proxyService;
  const secretRepo = typeof context.secretService === 'function'
    ? context.secretService
    : () => context.secretService;

  // ── Register connector with RuntimeAPI ──────────────────────────────
  const api = typeof context.runtimeAPI === 'function'
    ? context.runtimeAPI()
    : context.runtimeAPI;
  if (api) {
    api.registerConnector('SCP_FILE_EXPLORER', (log, config) => {
      return new ScpFileExplorer(log, config);
    });
  }

  const app = expressAppGetter();

  // ── Helper ──────────────────────────────────────────────────────────
  function getExplorer(configId) {
    const exp = scpMap.get(configId);
    if (!exp) throw new Error('Error connection config not found');
    return exp;
  }

  // ── IPC: Register SCP session ───────────────────────────────────────
  ipcMain.handle('session.fe.scp.register', async (event, { id, config, proxyId }) => {
    let sshConfig = { ...config };

    if (proxyId) {
      logger.info(`SCP connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, sshConfig.host, sshConfig.port || 22, secretRepo, logger);
          sshConfig.sock = sock;
        }
      }
    }

    const explorer = new ScpFileExplorer(logger, sshConfig);
    scpMap.set(id, explorer);
  });

  // ── Express: Bulk download by profileId ─────────────────────────────
  app.post('/api/v1/scp/download', downloadLimiter, async (req, res) => {
    const { profileId, path: filePath, proxyId, secretId } = req.body;
    if (!profileId || !filePath) {
      return res.status(400).json({ error: 'profileId and path are required' });
    }
    try {
      const runtime = new RuntimeAPI(logger);
      runtime.setProxyRepo(proxyRepo);
      runtime.setSecretRepo(secretRepo);
      const config = await runtime._resolveRemoteConfig(profileId, { proxyId, secretId });
      const explorer = new ScpFileExplorer(logger, config);
      const buffer = await explorer.downloadFile(filePath);
      const filename = filePath.split('/').pop() || 'download';
      const encoded = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      res.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
      res.send(buffer);
    } catch (error) {
      logger.error('SCP download error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Express: File operations (list/read/search/delete/rename/copy/move/create) ──
  app.post('/api/v1/scp/:id', generalLimiter, async (req, res) => {
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
      logger.error('Error handling SCP/SFTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // ── Express: Upload file ────────────────────────────────────────────
  app.post('/api/v1/scp/upload/:id', uploadLimiter, upload.single('uploadFiles'), async (req, res) => {
    let targetDir;
    try {
      targetDir = JSON.parse(req.body.data).name;
    } catch (error) {
      logger.error('Error parsing upload data JSON:', error);
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
      logger.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  // ── Express: Download files ─────────────────────────────────────────
  app.post('/api/v1/scp/download/:id', downloadLimiter, upload.none(), async (req, res) => {
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
            logger.error(`Error fetching file ${p}${name}:`, fileError.message);
          }
        }
        zipfile.outputStream.pipe(res).on('close', () => {
          logger.info('ZIP file successfully sent.');
        });
        zipfile.end();
      }
    } catch (error) {
      logger.error('Error downloading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error downloading file: ' + error.message } });
    }
  });

  // ── Express: Open file (download → edit → auto-upload on change) ────
  app.post('/api/v1/scp/open/:id', openLimiter, upload.none(), async (req, res) => {
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
        logger.error(`Error opening file: ${result}`);
        res.status(500).send({ error: { code: 500, message: 'Error opening file' } });
        return;
      }

      let watcher = fs.watch(tempFilePath, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`File modified: ${tempFilePath}`);
          try {
            const updatedBuffer = await fsPromise.readFile(tempFilePath);
            const bufferStream = new Readable();
            bufferStream.push(updatedBuffer);
            bufferStream.push(null);

            const updateExplorer = getExplorer(configId);
            await updateExplorer.uploadFile(fullRemotePath, bufferStream);
            logger.info(`File updated successfully: ${fullRemotePath}`);
          } catch (error) {
            logger.error('Error uploading updated file:', error);
          }
        }
      });

      setTimeout(async () => {
        watcher.close();
        try {
          await fsPromise.unlink(tempFilePath);
        } catch (err) {
          logger.error('Error deleting temporary file:', err);
        }
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      logger.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });

  logger.info('[scp-file-explorer] Plugin registered');
}

module.exports = { register };