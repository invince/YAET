/**
 * fileExplorerBackendFactory — shared backend for file-explorer plugins.
 *
 * Extracted from the four ~300-line mirror backends:
 *   ftp-file-explorer / sftp-file-explorer / scp-file-explorer / samba-file-explorer
 *
 * Each plugin's backend/index.js becomes a thin wrapper (~40 lines) that calls
 * registerFileExplorerBackend(context, options) with its proto-specific config.
 *
 * Security notes (P0-S4):
 *   - Uses context.ipcMain (restricted wrapper) — NOT require('electron').ipcMain,
 *     so the manifest channel allowlist is enforced.
 *   - secretRepo/proxyRepo getters are passed through untouched; the
 *     PluginManager-provided restricted wrappers apply automatically.
 */
const { shell } = require('electron');
const { createProxyConnection } = require('./proxyUtils');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');
const fs = require('fs');
const fsPromise = require('fs/promises');
const os = require('os');
const uuid = require('uuid');
const { Readable } = require('stream');
const { generalLimiter, uploadLimiter, downloadLimiter, openLimiter } = require('../adapter/ipc/rateLimiter');

/**
 * @param {Object} context - plugin context (logger, expressApp, proxyService, secretService, runtimeAPI, ipcMain)
 * @param {Object} options
 * @param {string} options.proto - URL/log prefix, e.g. 'ftp' | 'sftp' | 'scp' | 'samba'
 * @param {string} [options.label] - human label for logs, e.g. 'FTP' | 'Samba'; default proto.toUpperCase()
 * @param {string} options.connectorType - RuntimeAPI connector type, e.g. 'FTP_FILE_EXPLORER'
 * @param {string} options.ipcChannel - e.g. 'session.fe.ftp.register'
 * @param {Function} options.ExplorerClass - explorer implementation (new (logger, config))
 * @param {number} options.defaultPort - fallback port for proxy connections
 * @param {Function} options.sockHost - (config) => host used for proxy connection
 * @param {Function} [options.configResolver] - optional RuntimeAPI config resolver
 * @param {boolean} [options.supportsSearch=true] - file-ops route supports 'search' action
 * @param {Function} [options.fixPath] - optional path normalizer applied to request paths
 * @param {boolean} [options.enableBulkDownload=false] - register POST /api/v1/<proto>/download (by profileId)
 * @param {string} [options.tempDirName] - temp dir name for the open-file flow
 * @param {Function} [options.joinPath] - (dir, name) => remote path; default path.join
 * @param {Function} [options.buildUploadPath] - (dir, filename) => remote path for uploads; default joinPath
 * @param {boolean} [options.normalizeUploadBuffer=false] - coerce upload data to Buffer (ftp quirk)
 * @param {boolean} [options.openUploadViaStream=false] - wrap watcher buffer in Readable (sftp/scp quirk)
 */
function registerFileExplorerBackend(context, options) {
  const {
    proto,
    label = proto.toUpperCase(),
    connectorType,
    ipcChannel,
    ExplorerClass,
    defaultPort,
    sockHost,
    configResolver,
    supportsSearch = true,
    fixPath = null,
    enableBulkDownload = false,
    tempDirName = `${proto}-temp-files`,
    notFoundMessage = 'Error connection config not found',
    joinPath = (dir, name) => path.join(dir || '', name || ''),
    buildUploadPath = null,
    normalizeUploadBuffer = false,
    openUploadViaStream = false,
  } = options;

  const logger = context.logger;
  const ipcMain = context.ipcMain;
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
    api.registerConnector(connectorType, (log, config) => {
      return new ExplorerClass(log, config);
    });
    if (typeof configResolver === 'function' && typeof api.registerConfigResolver === 'function') {
      api.registerConfigResolver(connectorType, configResolver);
    }
  }

  const app = expressAppGetter();
  const connectionMap = new Map();

  // ── Helper ──────────────────────────────────────────────────────────
  function getExplorer(configId) {
    const exp = connectionMap.get(configId);
    if (!exp) throw new Error(notFoundMessage);
    return exp;
  }

  // ── IPC: Register session ───────────────────────────────────────────
  ipcMain.handle(ipcChannel, async (event, { id, config, proxyId }) => {
    const explorerConfig = { ...config };

    if (proxyId) {
      logger.info(`${label} connection ${id}: Using proxy ${proxyId}`);
      const proxies = proxyRepo();
      if (proxies && proxies.proxies) {
        const proxy = proxies.proxies.find(p => p.id === proxyId);
        if (proxy) {
          const sock = await createProxyConnection(proxy, sockHost(explorerConfig), explorerConfig.port || defaultPort, secretRepo, logger);
          explorerConfig.sock = sock;
        }
      }
    }

    const explorer = new ExplorerClass(logger, explorerConfig);
    connectionMap.set(id, explorer);
  });

  // ── Express: Bulk download by profileId (sftp/scp only) ─────────────
  if (enableBulkDownload) {
    app.post(`/api/v1/${proto}/download`, downloadLimiter, async (req, res) => {
      const { profileId, path: filePath, proxyId, secretId } = req.body;
      if (!profileId || !filePath) {
        return res.status(400).json({ error: 'profileId and path are required' });
      }
      try {
        const { RuntimeAPI } = require('../runtime/runtimeAPI');
        const runtime = new RuntimeAPI(logger);
        runtime.setProxyRepo(proxyRepo);
        runtime.setSecretRepo(secretRepo);
        const config = await runtime._resolveRemoteConfig(profileId, { proxyId, secretId });
        const explorer = new ExplorerClass(logger, config);
        const buffer = await explorer.downloadFile(filePath);
        const filename = filePath.split('/').pop() || 'download';
        const encoded = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
        res.send(buffer);
      } catch (error) {
        logger.error(`${label} download error:`, error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  // ── Express: File operations ────────────────────────────────────────
  app.post(`/api/v1/${proto}/:id`, generalLimiter, async (req, res) => {
    const action = req.body.action || 'read';
    if (fixPath) {
      if (req.body.targetPath !== undefined) req.body.targetPath = fixPath(req.body.targetPath);
      if (req.body.path !== undefined) req.body.path = fixPath(req.body.path);
    }
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
          if (!supportsSearch) throw new Error(`Unknown action: ${action}`);
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
      logger.error(`Error handling ${label} request:`, error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // ── Express: Upload file ────────────────────────────────────────────
  app.post(`/api/v1/${proto}/upload/:id`, uploadLimiter, upload.single('uploadFiles'), async (req, res) => {
    const { data, filename } = req.body;
    let directoryPath;
    try {
      directoryPath = JSON.parse(data).name;
    } catch (error) {
      logger.error('Error parsing upload data JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    if (fixPath) directoryPath = fixPath(directoryPath);
    const configId = req.params['id'];

    if (!req.file) {
      logger.error('Error: No file uploaded');
      res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
      return;
    }

    try {
      const explorer = getExplorer(configId);
      const makePath = buildUploadPath || joinPath;
      const remotePath = makePath(directoryPath, filename || req.body.filename);
      let fileData = req.file.data || req.file.buffer;
      if (normalizeUploadBuffer && fileData && !(fileData instanceof Buffer)) {
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
  app.post(`/api/v1/${proto}/download/:id`, downloadLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const rawDir = downloadInput.path;
    const directoryPath = fixPath ? fixPath(rawDir) : rawDir;
    const names = downloadInput.names;
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);

      if (names.length === 1) {
        const buffer = await explorer.downloadFile(joinPath(directoryPath, names[0]));
        const encodedFilename = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        const zipfile = new yazl.ZipFile();
        for (const name of names) {
          try {
            const fullRemotePath = joinPath(directoryPath, name);
            const buffer = await explorer.downloadFile(fullRemotePath);
            zipfile.addBuffer(buffer, name);
          } catch (fileError) {
            logger.error(`Error fetching file ${joinPath(directoryPath, name)}:`, fileError.message);
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
  app.post(`/api/v1/${proto}/open/:id`, openLimiter, upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      logger.error('Error parsing downloadInput JSON:', error);
      res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
      return;
    }
    const rawDir = downloadInput.path;
    const remoteDir = fixPath ? fixPath(rawDir) : rawDir;
    const fileName = downloadInput.names[0];
    const configId = req.params['id'];

    try {
      const explorer = getExplorer(configId);
      const fullRemotePath = joinPath(remoteDir, fileName);
      const tempDir = path.join(os.tmpdir(), tempDirName);
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

      const watcher = fs.watch(tempFilePath, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`File modified: ${tempFilePath}`);
          try {
            const updatedBuffer = await fsPromise.readFile(tempFilePath);
            let payload = updatedBuffer;
            if (openUploadViaStream) {
              const bufferStream = new Readable();
              bufferStream.push(updatedBuffer);
              bufferStream.push(null);
              payload = bufferStream;
            }
            const updateExplorer = getExplorer(configId);
            await updateExplorer.uploadFile(fullRemotePath, payload);
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

  logger.info(`[${proto}-file-explorer] Plugin registered`);
}

module.exports = { registerFileExplorerBackend };
