const path = require('path');
const { promises: fsPromise } = require('fs');
const simpleGit = require('simple-git');
const { ProxyService } = require('./proxyService');
const { APP_CONFIG_PATH, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, PROXIES_JSON } = require('./configService');

const GIT_FOLDER = 'git';
const BACKUP_FOLDER = 'backup';

class CloudService {
  constructor(log) {
    this.log = log;
    this.proxyService = new ProxyService(log);
  }

  getJsonFilesForCloud(items) {
    if (!items) return [];
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

  async upload(cloudSettings, proxyRepo, secretRepo) {
    const response = { succeed: false, ok: [], ko: [] };

    if (!cloudSettings) {
      response.ko.push('no cloud setting found');
      return response;
    }

    try {
      const gitAbsDir = path.join(APP_CONFIG_PATH, GIT_FOLDER);

      let gitUser = encodeURIComponent(cloudSettings.login);
      let gitPassword = encodeURIComponent(cloudSettings.password);
      let gitRepoUrl = cloudSettings.url;
      gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
      gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

      let jsonFiles = this.getJsonFilesForCloud(cloudSettings.items);

      this.log.info('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, { recursive: true, force: true });

      this.log.info('Cloning repository...');
      const git = simpleGit();

      let proxyId = cloudSettings.proxyId;
      let proxy = null;
      if (proxyId && proxyRepo) {
        const proxies = proxyRepo();
        proxy = proxies?.proxies?.find(p => p.id === proxyId);
      }
      const proxyUrl = proxy ? this.proxyService.getProxyUrl(proxy, secretRepo) : null;

      const cloneOptions = [];
      if (proxyUrl) cloneOptions.push('-c', `http.proxy=${proxyUrl}`);

      await git.clone(gitRepoUrl, gitAbsDir, cloneOptions);

      if (proxyUrl) {
        await git.cwd(gitAbsDir);
        await git.addConfig('http.proxy', proxyUrl);
      }

      this.log.info('Synchronizing JSON files...');
      const filesInRepo = await fsPromise.readdir(gitAbsDir);
      const fileToPush = jsonFiles.map(filePath => path.basename(filePath));

      for (const file of filesInRepo) {
        if (!fileToPush.includes(file) && file !== '.git') {
          const filePathToDelete = path.join(gitAbsDir, file);
          await fsPromise.rm(filePathToDelete, { recursive: true, force: true });
          response.ok.push('-' + file);
        }
      }

      for (const jsonFilePath of jsonFiles) {
        const fileName = path.basename(jsonFilePath);
        const destinationFilePath = path.join(gitAbsDir, fileName);
        await fsPromise.copyFile(jsonFilePath, destinationFilePath);
        response.ok.push('+' + fileName);
      }

      this.log.info('Committing and pushing changes...');
      await git.cwd(gitAbsDir);
      await git.add('.');
      await git.commit('Sync JSON files');
      await git.push('origin', 'main');
      response.ok.push('pushed');

    } catch (error) {
      this.log.error('Error during upload:', error.message);
      response.ko.push(error.message);
      return response;
    }
    response.succeed = true;
    return response;
  }

  async download(cloudSettings, proxyRepo, secretRepo) {
    const response = { succeed: false, ok: [], ko: [] };

    if (!cloudSettings) {
      response.ko.push('no cloud setting found');
      return response;
    }

    const backupAbsDir = path.join(APP_CONFIG_PATH, BACKUP_FOLDER);
    const gitAbsDir = path.join(APP_CONFIG_PATH, GIT_FOLDER);

    let gitUser = encodeURIComponent(cloudSettings.login);
    let gitPassword = encodeURIComponent(cloudSettings.password);
    let gitRepoUrl = cloudSettings.url;
    gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
    gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

    let jsonFiles = this.getJsonFilesForCloud(cloudSettings.items);

    try {
      this.log.info('Backing up JSON files...');
      await fsPromise.rm(backupAbsDir, { recursive: true, force: true });
      await fsPromise.mkdir(backupAbsDir, { recursive: true });

      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const backupFilePath = path.join(backupAbsDir, fileName);
        try {
          await fsPromise.copyFile(file, backupFilePath);
        } catch (err) {
          if (err.code === 'ENOENT') {
            this.log.warn(`File not found (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }

      this.log.info('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, { recursive: true, force: true });

      this.log.info('Cloning repository...');
      const git = simpleGit();

      let proxy = null;
      if (cloudSettings.proxyId && proxyRepo) {
        const proxies = proxyRepo();
        proxy = proxies?.proxies?.find(p => p.id === cloudSettings.proxyId);
      }
      const proxyUrl = proxy ? this.proxyService.getProxyUrl(proxy, secretRepo) : null;

      const cloneOptions = [];
      if (proxyUrl) cloneOptions.push('-c', `http.proxy=${proxyUrl}`);

      await git.clone(gitRepoUrl, gitAbsDir, cloneOptions);

      this.log.info('Replacing JSON files ...');
      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const gitFilePath = path.join(gitAbsDir, fileName);
        try {
          await fsPromise.access(gitFilePath);
          await fsPromise.copyFile(gitFilePath, file);
          response.ok.push('<->' + fileName);
        } catch (err) {
          if (err.code === 'ENOENT') {
            this.log.warn(`File not found in Git repo (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }
    } catch (error) {
      this.log.error('Error:', error.message);
      response.ko.push(error.message);
      return response;
    }
    response.succeed = true;
    return response;
  }
}

module.exports = { CloudService };
