const { ipcMain, shell } = require('electron');
const { S3FileExplorer } = require('./s3.connector');

const s3Map = new Map();

function register(context) {
  const logger = context.logger;
  const pr = context.projectRequire;
  const expressAppGetter = typeof context.expressApp === 'function'
    ? () => context.expressApp()
    : () => context.expressApp;

  const multer = pr('multer');
  const upload = multer();
  const path = pr('path');
  const yazl = pr('yazl');
  const fs = pr('fs');
  const fsPromise = pr('fs/promises');
  const os = pr('os');
  const uuid = pr('uuid');

  const api = typeof context.runtimeAPI === 'function'
    ? context.runtimeAPI()
    : context.runtimeAPI;
  if (api) {
    api.registerConnector('S3_FILE_EXPLORER', (log, config) => {
      return new S3FileExplorer(log);
    });
  }

  const app = expressAppGetter();

  function getExplorer(configId) {
    const exp = s3Map.get(configId);
    if (!exp) throw new Error('S3 session not found');
    return exp;
  }

  ipcMain.handle('session.fe.s3.register', async (event, { id, config }) => {
    logger.info(`[s3-file-explorer] Register called for session: ${id}`);
    try {
      // Resolve credentials from secret system (PluginSession maps secret.login → config.username, secret.password → config.password)
      if (config.username && !config.accessKeyId) {
        config.accessKeyId = config.username;
      }
      if (config.password && !config.secretAccessKey) {
        config.secretAccessKey = config.password;
      }

      const explorer = new S3FileExplorer(logger);
      explorer.setConfig(config);
      s3Map.set(id, explorer);
      logger.info(`[s3-file-explorer] Session registered: ${id}`);
    } catch (err) {
      logger.error(`[s3-file-explorer] Registration failed: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle('fe.list.s3', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    return explorer.listFiles(path);
  });

  ipcMain.handle('fe.read.s3', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    const data = await explorer.readFile(path);
    return data.toString('base64');
  });

  ipcMain.handle('fe.write.s3', async (event, { sessionId, path, content }) => {
    const explorer = getExplorer(sessionId);
    await explorer.writeFile(path, Buffer.from(content, 'base64'));
    return { ok: true };
  });

  ipcMain.handle('fe.delete.s3', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    await explorer.deleteFile(path);
    return { ok: true };
  });

  ipcMain.handle('fe.rename.s3', async (event, { sessionId, oldPath, newPath }) => {
    const explorer = getExplorer(sessionId);
    await explorer.renameFile(oldPath, newPath);
    return { ok: true };
  });

  // Express: File operations
  app.post('/api/v1/s3/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';
    const configId = req.params.id;

    try {
      const explorer = getExplorer(configId);
      let result;

      switch (action) {
        case 'read': {
          const data = await explorer.listFiles(pathParam);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data };
          break;
        }
        case 'search': {
          const searchString = req.body.searchString || '';
          const data = await explorer.search(pathParam, searchString);
          result = { cwd: { name: pathParam, type: 'folder' }, files: data };
          break;
        }
        case 'delete': {
          const items = req.body.data || [];
          const keys = items.map(item =>
            (pathParam.replace(/\/$/, '') + '/' + item.name).replace(/\/\//g, '/')
              .replace(/^\//, '')
          );
          if (keys.length > 0) {
            await explorer.deleteBatch(keys.map(Key => ({ Key })));
          }
          const files = await explorer.listFiles(pathParam);
          result = { cwd: { name: pathParam, type: 'folder' }, files };
          break;
        }
        case 'rename': {
          const oldP = (pathParam.replace(/\/$/, '') + '/' + req.body.name).replace(/\/\//g, '/');
          const newP = (pathParam.replace(/\/$/, '') + '/' + req.body.newName).replace(/\/\//g, '/');
          await explorer.renameFile(oldP, newP);
          const files = await explorer.listFiles(pathParam);
          result = { cwd: { name: pathParam, type: 'folder' }, files };
          break;
        }
        case 'copy': {
          const names = req.body.names || [];
          const targetPath = req.body.targetPath || pathParam;
          for (const name of names) {
            const src = (pathParam.replace(/\/$/, '') + '/' + name).replace(/\/\//g, '/');
            const dst = (targetPath.replace(/\/$/, '') + '/' + name).replace(/\/\//g, '/');
            await explorer.copyFile(src.replace(/^\//, ''), dst.replace(/^\//, ''));
          }
          const files = await explorer.listFiles(targetPath);
          result = { cwd: { name: targetPath, type: 'folder' }, files };
          break;
        }
        case 'move': {
          const names = req.body.names || [];
          const targetPath = req.body.targetPath || pathParam;
          for (const name of names) {
            const src = (pathParam.replace(/\/$/, '') + '/' + name).replace(/\/\//g, '/');
            const dst = (targetPath.replace(/\/$/, '') + '/' + name).replace(/\/\//g, '/');
            await explorer.renameFile(src, dst);
          }
          const files = await explorer.listFiles(targetPath);
          result = { cwd: { name: targetPath, type: 'folder' }, files };
          break;
        }
        case 'create': {
          const newName = req.body.name || '';
          if (newName) {
            await explorer.createFolder(pathParam, newName);
          }
          const files = await explorer.listFiles(pathParam);
          result = { cwd: { name: pathParam, type: 'folder' }, files };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      res.json(result);
    } catch (error) {
      logger.error('[s3-file-explorer] Error:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // Express: Upload file
  app.post('/api/v1/s3/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    let targetDir;
    try {
      targetDir = JSON.parse(req.body.data).name;
    } catch (error) {
      return res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
    }
    const configId = req.params.id;

    if (!req.file) {
      return res.status(400).send({ error: { code: 400, message: 'No file uploaded' } });
    }

    try {
      const explorer = getExplorer(configId);
      const remotePath = `${targetDir.replace(/\/$/, '')}/${req.body.filename}`.replace(/\/\//g, '/');
      await explorer.writeFile(remotePath, req.file.buffer);
      res.json({ success: true, message: `File uploaded to ${remotePath}` });
    } catch (error) {
      logger.error('[s3] Upload error:', error);
      res.status(400).send({ error: { code: 400, message: 'Upload error: ' + error.message } });
    }
  });

  // Express: Download files
  app.post('/api/v1/s3/download/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      return res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
    }
    const remoteDir = downloadInput.path;
    const names = downloadInput.names;
    const configId = req.params.id;

    try {
      const explorer = getExplorer(configId);
      const maxFileSize = (explorer._config && explorer._config.maxFileSize) || 100;

      if (names.length === 1) {
        const fullPath = remoteDir.replace(/\/$/, '') + '/' + names[0];
        const buffer = await explorer.readFile(fullPath);

        if (buffer.length > maxFileSize * 1024 * 1024) {
          return res.status(400).send({
            error: { code: 400, message: `File exceeds max size limit (${maxFileSize}MB)` }
          });
        }

        const encoded = encodeURIComponent(names[0]).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
        res.send(buffer);
      } else if (names.length > 1) {
        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');
        const zipfile = new yazl.ZipFile();
        for (const name of names) {
          try {
            const fullPath = remoteDir.replace(/\/$/, '') + '/' + name;
            const buffer = await explorer.readFile(fullPath);
            zipfile.addBuffer(buffer, name);
          } catch (fileError) {
            logger.error(`[s3] Error fetching ${name}:`, fileError.message);
          }
        }
        zipfile.outputStream.pipe(res).on('close', () => {
          logger.info('[s3] ZIP sent');
        });
        zipfile.end();
      }
    } catch (error) {
      logger.error('[s3-file-explorer] Download error:', error);
      res.status(400).send({ error: { code: 400, message: 'Download error: ' + error.message } });
    }
  });

  // Express: Open file
  app.post('/api/v1/s3/open/:id', upload.none(), async (req, res) => {
    let downloadInput;
    try {
      downloadInput = JSON.parse(req.body.downloadInput);
    } catch (error) {
      return res.status(400).send({ error: { code: 400, message: 'Invalid JSON: ' + error.message } });
    }
    const remoteDir = downloadInput.path;
    const fileName = downloadInput.names[0];
    const configId = req.params.id;

    try {
      const explorer = getExplorer(configId);
      const maxFileSize = (explorer._config && explorer._config.maxFileSize) || 100;
      const fullRemotePath = remoteDir.replace(/\/$/, '') + '/' + fileName;

      const buffer = await explorer.readFile(fullRemotePath);

      if (buffer.length > maxFileSize * 1024 * 1024) {
        return res.status(400).send({
          error: { code: 400, message: `File exceeds max size limit (${maxFileSize}MB)` }
        });
      }

      const tempDir = path.join(os.tmpdir(), 's3-temp-files');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, uuid.v4() + '_' + fileName);
      await fsPromise.writeFile(tempFilePath, buffer);

      const result = await shell.openPath(tempFilePath);
      if (result) {
        return res.status(500).send({ error: { code: 500, message: 'Error opening file: ' + result } });
      }

      const watcher = fs.watch(tempFilePath, async (eventType) => {
        if (eventType === 'change') {
          try {
            const updatedBuffer = await fsPromise.readFile(tempFilePath);
            await explorer.writeFile(fullRemotePath, updatedBuffer);
          } catch (error) {
            logger.error('[s3] Auto-upload error:', error);
          }
        }
      });

      setTimeout(async () => {
        watcher.close();
        try {
          await fsPromise.unlink(tempFilePath);
        } catch (err) {
          logger.error('[s3] Temp file cleanup error:', err);
        }
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      logger.error('[s3-file-explorer] Open error:', error);
      res.status(400).send({ error: { code: 400, message: 'Open error: ' + error.message } });
    }
  });

  logger.info('[s3-file-explorer] Plugin registered');
}

module.exports = { register };
