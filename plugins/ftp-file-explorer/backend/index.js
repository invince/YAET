/**
 * FTP File Explorer Plugin — Backend Entry
 *
 * Registers IPC handlers and Express routes for FTP file operations.
 * Migrated from src-electron/adapter/ipc/file-explorer/ftpHandler.js
 */
const { ipcMain, shell } = require('electron');
const { FtpFileExplorer } = require('./ftp');
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

/** Module-level connection map (managed internally) */
const ftpMap = new Map();

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
    api.registerConnector('FTP_FILE_EXPLORER', (log, config) => {
      return new FtpFileExplorer(log, config);
    });
    api.registerConfigResolver('FTP_FILE_EXPLORER', (connProfile, { secretId, secretRepo }) => {
      const config = {
        host: connProfile.host,
        port: connProfile.port || 21,
        user: connProfile.login || 'anonymous',
        password: connProfile.password || 'guest',
        secure: connProfile.secured || false,
      };
      const sid = secretId || connProfile.secretId;
      if ((connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || secretId) && sid) {
        const secrets = typeof secretRepo === 'function' ? secretRepo() : secretRepo;
        if (secrets && secrets.secrets) {
          const secret = secrets.secrets.find(s => s.id === sid);
          if (secret) {
            if (secret.secretType === 'LOGIN_PASSWORD' || secret.secretType === 'login_password') {
              config.user = secret.login;
              config.password = secret.password;
            } else if (secret.secretType === 'PASSWORD_ONLY' || secret.secretType === 'password_only') {
              config.password = secret.password;
              if (secret.login) config.user = secret.login;
            }
          }
        }
      }
      return config;
    });
  }

  const app = expressAppGetter();

  // ── Helper ──────────────────────────────────────────────────────────
  function getExplorer(configId) {
    const exp = ftpMap.get(configId);
    if (!exp) throw new Error('Error connection config not found');
    return exp;
  }

  // ── IPC: Register FTP session ───────────────────────────────────────
  ipcMain.handle('session.fe.ftp.register', async (event, { id, config, proxyId }) => {
    let ftpConfig = { ...config };

    if (proxyId) {
      logger.info(`FTP connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, ftpConfig.host, ftpConfig.port || 21, secretRepo, logger);
          ftpConfig.sock = sock;
        }
      }
    }

    const explorer = new FtpFileExplorer(logger, ftpConfig);
    ftpMap.set(id, explorer);
  });

  // ── Express: File operations ────────────────────────────────────────
  app.post('/api/v1/ftp/:id', generalLimiter, async (req, res) => {
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
      logger.error('Error handling FTP request:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // ── Express: Upload file ────────────────────────────────────────────
  app.post('/api/v1/ftp/upload/:id', uploadLimiter, upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    let directoryPath;
    try {
      directoryPath = JSON.parse(data).name;
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
      logger.error('Error uploading file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error uploading file: ' + error.message } });
    }
  });

  // ── Express: Download files ─────────────────────────────────────────
  app.post('/api/v1/ftp/download/:id', downloadLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
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
            logger.error(`Error fetching file ${fullRemotePath}:`, fileError.message);
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
  app.post('/api/v1/ftp/open/:id', openLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
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

      setTimeout(() => {
        watcher.close();
        fsPromise.unlink(tempFilePath)
          .then(() => logger.info('Temporary file deleted:', tempFilePath))
          .catch((err) => logger.info('Error deleting temp file:', err));
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      logger.error('Error open file:', error);
      res.status(400).send({ error: { code: 400, message: 'Error open file: ' + error.message } });
    }
  });

  logger.info('[ftp-file-explorer] Plugin registered');
}

module.exports = { register };