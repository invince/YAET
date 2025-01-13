const { ipcMain  } = require('electron');
const SftpClient = require('ssh2-sftp-client');
const multer = require('multer');
const upload = multer();
const path = require('path');
const yazl = require('yazl');

function initScpSftpHandler(log, scpMap, expressApp) {

  ipcMain.handle('session.fe.scp.register', async (event, {id, config}) => {
    scpMap.set(id, config);
  });

//==================== API ==========================================================

  expressApp.post('/api/v1/scp/:id', async (req, res) => {
    const action = req.body.action || 'read';
    const pathParam = req.body.path || '/';

    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      res.status(400).send({ error: {code: 400, message: 'Error connection config not found'} });
    }
    try {
      const sftp = new SftpClient();
      await sftp.connect(config);
      switch (action) {
        case 'read': {
          const files = await sftp.list(pathParam);

          const formattedFiles = files.map(file => ({
            name: file.name,
            type: file.type === 'd' ? 'folder' : 'file',
            isFile: file.type !== 'd',
            size: file.size,
            dateModified: file.modifyTime,
          }));

          res.json({ cwd: { name: pathParam, type: 'folder' }, files: formattedFiles });
          break;
        }
        case 'search': {
          const files = await sftp.list(pathParam);

          const regexFlags = req.body.caseSensitive ? '' : 'i';
          const searchRegex = new RegExp(req.body.searchString.replace(/\*/g, '.*'), regexFlags);

          const formattedFiles = [];
          for (const item of files) {
            const isHidden = item.name.startsWith('.');
            if (!req.body.showHiddenItems && isHidden) continue;

            if (searchRegex.test(item.name)) {
              formattedFiles.push({
                name: item.name,
                type: item.type === '-' ? 'file' : 'folder',
                size: item.size,
                modifyTime: item.modifyTime,
                accessTime: item.accessTime,
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
            details.push(await getDetails(sftp, pathParam, [name]));
            if (oneData.type === 'folder') {
              await sftp.rmdir(fileAbsPath, true);
            } else {
              await sftp.delete(fileAbsPath);
            }
          }
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: details});
          break;
        }
        case 'rename': {
          const name = req.body.name;
          const newName = req.body.newName;
          await sftp.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: await getDetails(sftp, pathParam, newName) });
          break;
        }
        case 'copy': {
          const names = req.body.names || [];
          const targetPath = req.body.targetPath;
          for (const name of names) {
            const sourceFilePath = `${pathParam}${name}`;
            const targetFilePathOg = `${targetPath}${name}`;
            const targetFilePath = await avoidDuplicateName(sftp, targetFilePathOg);
            // Copy file
            await sftp.rcopy(sourceFilePath, targetFilePath);
          }
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: await getDetails(sftp, targetPath, names) });
          break;
        }
        case 'move': {
          const names = req.body.names || [];
          const targetPath = req.body.targetPath;
          if (targetPath === pathParam) {
            break;
          }
          for (const name of names) {
            const sourceFilePath = `${pathParam}${name}`;
            const targetFilePathOg = `${targetPath}${name}`;
            const targetFilePath = await avoidDuplicateName(sftp, targetFilePathOg);
            // Copy file
            await sftp.rcopy(sourceFilePath, targetFilePath);
            await sftp.delete(sourceFilePath, true);
          }
          res.json({ cwd: { name: pathParam, type: 'folder' }, files: await getDetails(sftp, targetPath, names) });
          break;
        }
        case 'create': { // for now only mkdir is possible
          const name = req.body.name;
          const newFolderPath = `${pathParam}${name}`;
          if (await sftp.exists(newFolderPath)) {
            res.json({ cwd: { name: pathParam, type: 'folder' }, error: {code: 416, message: 'folder already exists'} });
          } else {
            // Create the folder
            await sftp.mkdir(newFolderPath, true);

            res.json({ cwd: { name: pathParam, type: 'folder' }, files: await getDetails(sftp, newFolderPath) });
          }
          break;
        }
        case 'details': {
          const names = req.body.names || [];
          res.json({ cwd: { name: pathParam, type: 'folder' }, details: await getDetails(sftp, pathParam, names) });
          break;
        }

      }

      await sftp.end();
    } catch (error) {
      log.error('Error listing files:', error);
      res.status(500).send({ error: {code: 500, message: error} });
    }
  });

// File Upload
  expressApp.post('/api/v1/scp/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const {  data } = req.body;
    const path = JSON.parse(data).name; // path is incorrect on req.body
    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      log.error('Error connection config not found');
      res.status(400).send({ error: {code: 400, message: 'Error connection config not found'} });
    }
    if (!req.file) {
      log.error('Error: No file uploaded');
      res.status(400).send({ error: {code: 400, message: 'No file uploaded'} });
    }

    try {
      const sftp = new SftpClient();

      // Connect to the SFTP server
      await sftp.connect(config);

      // Upload the file
      const remotePath = await avoidDuplicateName(sftp, `${path}/${req.file.originalname}`);
      await sftp.put(req.file.buffer, remotePath);

      res.json({ success: true, message: `File uploaded to ${remotePath}` });

      // End the SFTP connection
      await sftp.end();
    } catch (error) {
      log.error('Error uploading file:', error);
      res.status(400).send({ error: {code: 400, message: 'Error uploading file:' + error} });
    }
  });

// File Download
  expressApp.post('/api/v1/scp/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const path = downloadInput.path;
    const names = downloadInput.names; // Assuming a single file download

    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      log.error('Error connection config not found');
      res.status(400).send({ error: {code: 400, message: 'Error connection config not found'} });
    }
    try {
      const sftp = new SftpClient();
      await sftp.connect(config);

      if (names.length === 1) {
        const fullPath = path + names[0];
        const buffer = await sftp.get(fullPath);

        res.set('Content-Disposition', `attachment; filename=${names[0]}`);
        res.send(buffer);


        await sftp.end();

      } else if (names.length > 1) {

        res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');
        res.setHeader('Content-Type', 'application/zip');

        // Create a new ZIP file instance
        const zipfile = new yazl.ZipFile();

        for (const name of names) {
          const fullPath = `${path}${name}`;

          try {
            // Fetch the file as a buffer from the server
            const buffer = await sftp.get(fullPath);

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

        await sftp.end();
      }

    } catch (error) {
      log.error('Error downloading file:', error);
      res.status(400).send({ error: {code: 400, message: 'Error download file:' + error} });
    }
  });

//================= Utils =================================================
  async function avoidDuplicateName(sftp, targetFilePathOg) {

    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath)); // Extract file name without extension
      const fileExt = path.extname(filePath); // Extract extension
      const dir = path.dirname(filePath); // Extract directory path
      return {dir, fileName, fileExt};
    };

    const {dir, fileName, fileExt} = parseFilePath(targetFilePathOg);
    let index = 1; // Start indexing from 1 for suffix

    // Check if file exists and generate new target path
    while (await sftp.exists(targetFilePath)) {
      targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      index++;
    }
    return targetFilePath;
  }

  async function getDetails(sftp, path, names = undefined) {
    if (!names || names.length === 0) {
      const fullPath = `${path}`;
      const stats = await sftp.stat(fullPath);

      return {
        name: fullPath,
        type: stats.isDirectory ? 'folder' : 'file',
        size: stats.size,
        accessTime: stats.atime,
        modifyTime: stats.mtime,
        createTime: stats.birthtime || null, // birthtime may not always be available
      };
    } else {
      let details;
      for (const name of names) {
        const fullPath = `${path}${name}`;
        const stats = await sftp.stat(fullPath);
        if (details) {
          details.size = details.size + stats.size;
          details.name = details.name + ", " + name;
          details.multipleFiles = true;
          details.type = undefined;
          details.modified = undefined;
        } else {
          details = {
            name: name,
            type: stats.isDirectory ? 'folder' : 'file',
            size: stats.size,
            location: path,
            modified: stats.modifyTime,
          }
        }
      }
      return details;
    }

  }


// Start API
  expressApp.listen(13012, () => log.info('API listening on port 13012'));
}

module.exports = {initScpSftpHandler};
