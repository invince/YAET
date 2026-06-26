const { ipcMain, shell } = require('electron');
const { WebDavFileExplorer } = require('./webdav.connector');

const webdavMap = new Map();

function register(context) {
  const logger = context.logger;
  const pr = context.projectRequire;
  const expressAppGetter = typeof context.expressApp === 'function'
    ? () => context.expressApp()
    : () => context.expressApp;

  // npm deps resolved via projectRequire (rooted at project's node_modules)
  const multer = pr('multer');
  const upload = multer();
  const path = pr('path');
  const yazl = pr('yazl');
  const fs = pr('fs');
  const fsPromise = pr('fs/promises');
  const os = pr('os');
  const uuid = pr('uuid');
  const { Readable } = pr('stream');

  const api = typeof context.runtimeAPI === 'function'
    ? context.runtimeAPI()
    : context.runtimeAPI;
  if (api) {
    api.registerConnector('WEBDAV_FILE_EXPLORER', (log, config) => {
      return new WebDavFileExplorer(log);
    });
  }

  const app = expressAppGetter();

  function getExplorer(configId) {
    const exp = webdavMap.get(configId);
    if (!exp) throw new Error('WebDAV session not found');
    return exp;
  }

  ipcMain.handle('session.fe.webdav.register', async (event, { id, config }) => {
    const explorer = new WebDavFileExplorer(logger);
    explorer.setConfig(config);
    webdavMap.set(id, explorer);
    logger.info(`[webdav-file-explorer] Session registered: ${id}`);
  });

  ipcMain.handle('fe.list.webdav', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    return explorer.listFiles(path);
  });

  ipcMain.handle('fe.read.webdav', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    const data = await explorer.readFile(path);
    return data.toString('base64');
  });

  ipcMain.handle('fe.write.webdav', async (event, { sessionId, path, content }) => {
    const explorer = getExplorer(sessionId);
    await explorer.writeFile(path, Buffer.from(content, 'base64'));
    return { ok: true };
  });

  ipcMain.handle('fe.delete.webdav', async (event, { sessionId, path }) => {
    const explorer = getExplorer(sessionId);
    await explorer.deleteFile(path);
    return { ok: true };
  });

  ipcMain.handle('fe.rename.webdav', async (event, { sessionId, oldPath, newPath }) => {
    const explorer = getExplorer(sessionId);
    await explorer.renameFile(oldPath, newPath);
    return { ok: true };
  });

  // Express: File operations
  app.post('/api/v1/webdav/:id', async (req, res) => {
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
        case 'delete': {
          const items = req.body.data || [];
          for (const item of items) {
            await explorer.deleteFile((pathParam.replace(/\/$/, '') + '/' + item.name).replace(/\/\//g, '/'));
          }
          result = { cwd: { name: pathParam, type: 'folder' }, files: [] };
          break;
        }
        case 'rename': {
          const oldP = (pathParam.replace(/\/$/, '') + '/' + req.body.name).replace(/\/\//g, '/');
          const newP = pathParam.replace(/\/$/, '/') + req.body.newName;
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
            const data = await explorer.readFile(src);
            await explorer.writeFile(dst, data);
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
          result = { cwd: { name: pathParam, type: 'folder' }, files: [] };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      res.json(result);
    } catch (error) {
      logger.error('[webdav-file-explorer] Error:', error);
      res.status(500).send({ error: { code: 500, message: error.message } });
    }
  });

  // Express: Upload file
  app.post('/api/v1/webdav/upload/:id', upload.single('uploadFiles'), async (req, res) => {
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
      const remotePath = `${targetDir.replace(/\/$/, '')}/${req.body.filename}`;
      await explorer.writeFile(remotePath, req.file.buffer);
      res.json({ success: true, message: `File uploaded to ${remotePath}` });
    } catch (error) {
      logger.error('[webdav] Upload error:', error);
      res.status(400).send({ error: { code: 400, message: 'Upload error: ' + error.message } });
    }
  });

  // Express: Download files
  app.post('/api/v1/webdav/download/:id', upload.none(), async (req, res) => {
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

      if (names.length === 1) {
        const fullPath = remoteDir.replace(/\/$/, '') + '/' + names[0];
        const buffer = await explorer.readFile(fullPath);
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
            logger.error(`[webdav] Error fetching ${name}:`, fileError.message);
          }
        }
        zipfile.outputStream.pipe(res).on('close', () => {
          logger.info('[webdav] ZIP sent');
        });
        zipfile.end();
      }
    } catch (error) {
      logger.error('[webdav] Download error:', error);
      res.status(400).send({ error: { code: 400, message: 'Download error: ' + error.message } });
    }
  });

  // Express: Open file
  app.post('/api/v1/webdav/open/:id', upload.none(), async (req, res) => {
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
      const fullRemotePath = remoteDir.replace(/\/$/, '') + '/' + fileName;
      const tempDir = path.join(os.tmpdir(), 'webdav-temp-files');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, uuid.v4() + '_' + fileName);
      const buffer = await explorer.readFile(fullRemotePath);
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
            logger.error('[webdav] Auto-upload error:', error);
          }
        }
      });

      setTimeout(async () => {
        watcher.close();
        try {
          await fsPromise.unlink(tempFilePath);
        } catch (err) {
          logger.error('[webdav] Temp file cleanup error:', err);
        }
      }, 10 * 60 * 1000);

      res.json({ success: true, message: `File opened: ${fullRemotePath}` });
    } catch (error) {
      logger.error('[webdav] Open error:', error);
      res.status(400).send({ error: { code: 400, message: 'Open error: ' + error.message } });
    }
  });

  logger.info('[webdav-file-explorer] Plugin registered');
}

module.exports = { register };
