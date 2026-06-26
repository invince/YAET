/**
 * Samba/CIFS File Explorer Plugin — Backend Entry
 *
 * Registers IPC handlers and Express routes for Samba file operations.
 * Migrated from src-electron/adapter/ipc/file-explorer/sambaHandler.js
 */
const { ipcMain, shell } = require('electron');
const { SambaFileExplorer } = require('./samba');
const { createProxyConnection } = require('../../../src-electron/utils/proxyUtils');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const { generalLimiter, uploadLimiter, downloadLimiter, openLimiter } = require('../../../src-electron/adapter/ipc/rateLimiter');

/** Module-level connection map (managed internally) */
const sambaMap = new Map();

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
    api.registerConnector('SAMBA_FILE_EXPLORER', (log, config) => {
      return new SambaFileExplorer(log, config);
    });
    api.registerConfigResolver('SAMBA_FILE_EXPLORER', (connProfile, { secretId, secretRepo }) => {
      const config = {
        share: connProfile.share,
        domain: connProfile.domain || 'WORKGROUP',
        username: connProfile.login || '',
        password: connProfile.password || '',
        port: connProfile.port || 445,
      };
      // Set host for proxy support
      const shareParts = (connProfile.share || '').split('/');
      config.host = shareParts[0] || '';
      const sid = secretId || connProfile.secretId;
      if ((connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || secretId) && sid) {
        const secrets = typeof secretRepo === 'function' ? secretRepo() : secretRepo;
        if (secrets && secrets.secrets) {
          const secret = secrets.secrets.find(s => s.id === sid);
          if (secret) {
            if (secret.secretType === 'LOGIN_PASSWORD' || secret.secretType === 'login_password') {
              config.username = secret.login;
              config.password = secret.password;
            } else if (secret.secretType === 'PASSWORD_ONLY' || secret.secretType === 'password_only') {
              config.password = secret.password;
              if (secret.login) config.username = secret.login;
            }
          }
        }
      }
      return config;
    });
  }

  const app = expressAppGetter();

  // ── Helpers ─────────────────────────────────────────────────────────
  function getExplorer(configId) {
    const exp = sambaMap.get(configId);
    if (!exp) throw new Error('Error: connection config not found');
    return exp;
  }

  function fixPath(pathParam) {
    let p = pathParam || '';
    if (p.endsWith('/')) p = p.slice(0, -1);
    if (p.startsWith('/')) p = p.slice(1);
    return p;
  }

  // ── IPC: Register Samba session ─────────────────────────────────────
  ipcMain.handle('session.fe.samba.register', async (event, { id, config, proxyId }) => {
    let smbConfig = { ...config };

    if (proxyId) {
      logger.info(`Samba connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, smbConfig.share, smbConfig.port || 445, secretRepo, logger);
          smbConfig.sock = sock;
        }
      }
    }

    const explorer = new SambaFileExplorer(logger, smbConfig);
    sambaMap.set(id, explorer);
  });

  // ── Express: File operations ────────────────────────────────────────
  app.post('/api/v1/samba/:id', generalLimiter, async (req, res) => {
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
      logger.error('Error handling Samba request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // ── Express: Upload file ────────────────────────────────────────────
  app.post('/api/v1/samba/upload/:id', uploadLimiter, upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    let targetDir;
    try {
      targetDir = fixPath(JSON.parse(data).name);
    } catch (error) {
      logger.error('Error parsing upload data JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const configId = req.params['id'];

    if (!req.file) {
      logger.error('Error: No file uploaded');
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
      logger.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  // ── Express: Download files ─────────────────────────────────────────
  app.post('/api/v1/samba/download/:id', downloadLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
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
            logger.error(`Error fetching file ${fullPath}:`, fileError.message);
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
  app.post('/api/v1/samba/open/:id', openLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
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
        logger.error(`Error opening file: ${result}`);
        res.status(500).send({ error: { code: 500, message: 'Error opening file' } });
        return;
      }

      let watcher = fs.watch(tempFilePath, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`File modified: ${tempFilePath}`);
          try {
            const updatedBuffer = await fsPromise.readFile(tempFilePath);
            const updateExplorer = getExplorer(configId);
            await updateExplorer.uploadFile(fullRemotePath, updatedBuffer);
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
          logger.info('Temporary file deleted:', tempFilePath);
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

  logger.info('[samba-file-explorer] Plugin registered');
}

module.exports = { register };