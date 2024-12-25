const { ipcMain , dialog } = require('electron');
const SftpClient = require('ssh2-sftp-client');
const multer = require('multer');
const upload = multer();


function initScpSftpHandler(scpMap, expressApp) {

  ipcMain.handle('session.fe.scp.register', async (event, {id, config}) => {
    scpMap.set(id, config);
  });

  expressApp.post('/list/:id', async (req, res) => {
    const path = req.body.path || '/';
    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      console.error('Error connection config not found');
      res.status(500).send({ error: 'Failed to list files' });
    }
    try {
      const sftp = new SftpClient();
      await sftp.connect(config);
      const files = await sftp.list(path);

      const formattedFiles = files.map(file => ({
        name: file.name,
        type: file.type === 'd' ? 'folder' : 'file',
        isFile: file.type !== 'd',
        size: file.size,
        dateModified: file.modifyTime,
      }));

      res.json({ cwd: { name: path, type: 'folder' }, files: formattedFiles });
      await sftp.end();
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).send({ error: 'Failed to list files' });
    }
  });

// File Upload
  expressApp.post('/upload/:id', upload.single('uploadFiles'), async (req, res) => {
    const {  data } = req.body;
    console.log(req.body);
    const path = JSON.parse(data).name; // path is incorrect on req.body
    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      console.error('Error connection config not found');
      res.status(500).send({ error: 'Failed to list files' });
    }
    if (!req.file) {
      console.error('Error: No file uploaded');
      return res.status(400).send({ error: 'No file uploaded' });
    }

    try {
      const sftp = new SftpClient();

      // Connect to the SFTP server
      await sftp.connect(config);

      // Upload the file
      const remotePath = `${path}/${req.file.originalname}`;
      await sftp.put(req.file.buffer, remotePath);

      res.json({ success: true, message: `File uploaded to ${remotePath}` });

      // End the SFTP connection
      await sftp.end();
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).send({ error: 'Failed to upload file' });
    }
  });

// File Download
  expressApp.post('/download/:id', upload.none(), async (req, res) => {
    const downloadInput = JSON.parse(req.body.downloadInput);
    const path = downloadInput.path;
    const names = downloadInput.names; // Assuming a single file download

    console.log(req.body);
    const configId = req.params['id'];
    const config = scpMap.get(configId);
    if (!config) {
      console.error('Error connection config not found');
      res.status(500).send({ error: 'Failed to list files' });
    }
    try {
      const sftp = new SftpClient();
      await sftp.connect(config);

      for (const name of names) {
        const fullPath = path + name;
        const buffer = await sftp.get(fullPath);

        res.set('Content-Disposition', `attachment; filename=${path.split('/').pop()}`);
        res.send(buffer);
      }

      await sftp.end();
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).send({ error: 'Failed to download file' });
    }
  });

// Start API
  expressApp.listen(3000, () => console.log('API listening on port 3000'));
}

module.exports = {initScpSftpHandler};
