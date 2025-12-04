const { ipcMain } = require('electron');
const path = require("path");
const { SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, PROXIES_JSON, GIT_FOLDER, APP_CONFIG_PATH, BACKUP_FOLDER } = require("../common");
const { promises: fsPromise } = require("fs");
const simpleGit = require("simple-git");
const { getProxyUrl } = require("../utils/proxyUtils");

function initCloudIpcHandler(log, getProxies, getSecrets) {

  ipcMain.handle('cloud.upload', async (event, data) => {

    const response = {
      succeed: false,
      ok: [],
      ko: []
    }

    if (!data || !data.data) {
      log.error("no cloud setting found");
      response.ko.push("no cloud setting found");
      return response;
    }

    try {
      const gitAbsDir = path.join(APP_CONFIG_PATH, GIT_FOLDER);

      let cloudSettings = data.data;

      let gitUser = encodeURIComponent(cloudSettings.login);
      let gitPassword = encodeURIComponent(cloudSettings.password);
      let gitRepoUrl = cloudSettings.url;
      gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
      gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

      let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

      // Step 1: Delete existing Git folder
      log.info('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, { recursive: true, force: true });

      // Step 2: Clone the Git repository
      log.info('Cloning repository...');
      const git = simpleGit();

      // Configure Proxy
      let proxyId = cloudSettings.proxyId;
      log.info(`Looking for proxy with ID: ${proxyId}`);
      const proxies = getProxies();
      log.info(`Available proxies: ${JSON.stringify(proxies?.proxies?.map(p => ({ id: p.id, name: p.name })))}`);
      let proxy = proxies?.proxies?.find(p => p.id === proxyId);
      log.info(`Found proxy: ${proxy ? proxy.name : 'undefined'}`);
      const proxyUrl = getProxyUrl(proxy, getSecrets, log);
      if (proxyUrl) {
        log.info(`Using proxy: ${proxyUrl}`);
        // await git.addConfig('http.proxy', proxyUrl);
      }

      const cloneOptions = [];
      if (proxyUrl) {
        cloneOptions.push('-c', `http.proxy=${proxyUrl}`);
      }

      await git.clone(gitRepoUrl, gitAbsDir, cloneOptions);

      // Re-configure proxy in the cloned repo just in case
      if (proxyUrl) {
        await git.cwd(gitAbsDir);
        await git.addConfig('http.proxy', proxyUrl);
      }

      // Step 3: Synchronize JSON files
      log.info('Synchronizing JSON files...');
      const filesInRepo = await fsPromise.readdir(gitAbsDir); // Get current files in the repo
      const fileToPush = jsonFiles.map(filePath => path.basename(filePath));
      // Delete files in the repo that are not in fileToPush
      for (const file of filesInRepo) {
        if (!fileToPush.includes(file) && file !== '.git') {
          const filePathToDelete = path.join(gitAbsDir, file);
          await fsPromise.rm(filePathToDelete, { recursive: true, force: true });
          response.ok.push('-' + file);
          log.info(`Deleted: ${file}`);
        }
      }
      // Replace or add files from fileToPush
      for (const jsonFilePath of jsonFiles) {
        const fileName = path.basename(jsonFilePath);
        const destinationFilePath = path.join(gitAbsDir, fileName);
        // Replace if exists, or add the file
        await fsPromise.copyFile(jsonFilePath, destinationFilePath);

        response.ok.push('+' + fileName);
        log.info(`Added or updated: ${fileName}`);
      }
      // Step 4: Commit and Push the Changes
      log.info('Committing and pushing changes...');
      await git.cwd(gitAbsDir); // Change working directory to the Git folder
      await git.add('.'); // Stage all changes
      await git.commit('Sync JSON files'); // Commit the changes
      await git.push('origin', 'main');

      response.ok.push('pushed');

      log.info('Successfully synchronized JSON files to the repository.');
    } catch (error) {
      log.error('Error during operation:', error.message);
      response.ko.push(error.message);
      return response;
    }
    response.succeed = true;
    return response;
  });


  ipcMain.handle('cloud.download', async (event, data) => {

    const response = {
      succeed: false,
      ok: [],
      ko: []
    }

    if (!data || !data.data) {
      log.error("no cloud setting found");
      response.ko.push("no cloud setting found");
      return response;
    }

    const backupAbsDir = path.join(APP_CONFIG_PATH, BACKUP_FOLDER);
    const gitAbsDir = path.join(APP_CONFIG_PATH, GIT_FOLDER);

    let cloudSettings = data.data;

    let gitUser = encodeURIComponent(cloudSettings.login);
    let gitPassword = encodeURIComponent(cloudSettings.password);
    let gitRepoUrl = cloudSettings.url;
    gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
    gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

    let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

    try {
      // Step 1: Backup JSON files
      log.info('Backing up JSON files...');
      await fsPromise.rm(backupAbsDir, { recursive: true, force: true });
      await fsPromise.mkdir(backupAbsDir, { recursive: true });

      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const backupFilePath = path.join(backupAbsDir, fileName);

        try {
          await fsPromise.copyFile(file, backupFilePath);
          log.info(`Backed up: ${fileName}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            log.warn(`File not found (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }

      // Step 2: Delete existing Git folder
      log.info('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, { recursive: true, force: true });

      // Step 3: Clone the repository
      log.info('Cloning repository...');
      const git = simpleGit();

      // Configure Proxy
      let proxyId = cloudSettings.proxyId;
      log.info(`Looking for proxy with ID: ${proxyId}`);
      const proxies = getProxies();
      log.info(`Available proxies: ${JSON.stringify(proxies?.proxies?.map(p => ({ id: p.id, name: p.name })))}`);
      let proxy = proxies?.proxies?.find(p => p.id === proxyId);
      log.info(`Found proxy: ${proxy ? proxy.name : 'undefined'}`);
      const proxyUrl = getProxyUrl(proxy, getSecrets, log);
      if (proxyUrl) {
        log.info(`Using proxy: ${proxyUrl}`);
        // await git.addConfig('http.proxy', proxyUrl);
      }

      const cloneOptions = [];
      if (proxyUrl) {
        cloneOptions.push('-c', `http.proxy=${proxyUrl}`);
      }

      await git.clone(gitRepoUrl, gitAbsDir, cloneOptions);

      // Step 4: Replace JSON files in the Git folder
      log.info('Replacing JSON files ...');
      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const gitFilePath = path.join(gitAbsDir, fileName);

        try {
          // Check if the file exists in the cloned repo
          await fsPromise.access(gitFilePath);

          // Replace the file
          await fsPromise.copyFile(gitFilePath, file);
          response.ok.push('<->' + fileName);
          log.info(`Replaced in Git repo: ${fileName}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            log.warn(`File not found in Git repo (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }

      log.info('Operation completed successfully.');
    } catch (error) {
      log.error('Error:', error.message);
      response.ko.push(error.message);
      return response;
    }
    response.succeed = true;
    return response;
  });


  function getJsonFilesForCloud(items) {
    if (!items) {
      return [];
    }
    const result = [];
    for (const item of items) {
      if (item.toLowerCase() === 'Setting'.toLowerCase()) {
        result.push(path.join(APP_CONFIG_PATH, SETTINGS_JSON));
      }
      if (item.toLowerCase() === 'Profile'.toLowerCase()) {
        result.push(path.join(APP_CONFIG_PATH, PROFILES_JSON));
      }
      if (item.toLowerCase() === 'Secret'.toLowerCase()) {
        result.push(path.join(APP_CONFIG_PATH, SECRETS_JSON));
      }
      if (item.toLowerCase() === 'Proxy'.toLowerCase()) {
        result.push(path.join(APP_CONFIG_PATH, PROXIES_JSON));
      }
    }
    return result;
  }

}

module.exports = { initCloudIpcHandler };
