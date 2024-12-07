const { ipcMain } = require('electron');
const path = require("path");
const {CONFIG_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, GIT_FOLDER  }= require("../common");
const {promises: fsPromise} = require("fs");
const simpleGit = require("simple-git");
function initCloudIpcHandler() {

  ipcMain.handle('cloud-upload', async (event, data) => {

    const response = {
      succeed: false,
      ok: [],
      ko: []
    }

    if (!data || !data.data) {
      console.error("no cloud setting found");
      response.ko.push("no cloud setting found");
      return response;
    }

    try {
      const gitAbsDir = path.join(process.cwd(), CONFIG_FOLDER, GIT_FOLDER);

      let cloudSettings = data.data;

      let gitUser = encodeURIComponent(cloudSettings.login);
      let gitPassword = encodeURIComponent(cloudSettings.password);
      let gitRepoUrl = cloudSettings.url;
      gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
      gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

      let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

      // Step 1: Delete existing Git folder
      console.log('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, {recursive: true, force: true});

      // Step 2: Clone the Git repository
      console.log('Cloning repository...');
      const git = simpleGit();
      await git.clone(gitRepoUrl, gitAbsDir);

      // Step 3: Synchronize JSON files
      console.log('Synchronizing JSON files...');
      const filesInRepo = await fsPromise.readdir(gitAbsDir); // Get current files in the repo
      const fileToPush = jsonFiles.map(filePath => path.basename(filePath));
      // Delete files in the repo that are not in fileToPush
      for (const file of filesInRepo) {
        if (!fileToPush.includes(file) && file !== '.git') {
          const filePathToDelete = path.join(gitAbsDir, file);
          await fsPromise.rm(filePathToDelete, {recursive: true, force: true});
          response.ok.push('-' + file);
          console.log(`Deleted: ${file}`);
        }
      }
      // Replace or add files from fileToPush
      for (const jsonFilePath of jsonFiles) {
        const fileName = path.basename(jsonFilePath);
        const destinationFilePath = path.join(gitAbsDir, fileName);
        // Replace if exists, or add the file
        await fsPromise.copyFile(jsonFilePath, destinationFilePath);

        response.ok.push('+' + fileName);
        console.log(`Added or updated: ${fileName}`);
      }
      // Step 4: Commit and Push the Changes
      console.log('Committing and pushing changes...');
      await git.cwd(gitAbsDir); // Change working directory to the Git folder
      await git.add('.'); // Stage all changes
      await git.commit('Sync JSON files'); // Commit the changes
      await git.push('origin', 'main');

      response.ok.push('pushed');

      console.log('Successfully synchronized JSON files to the repository.');
    } catch(error) {
      console.error('Error during operation:', error.message);
      response.ko.push(error.message);
      return response;
    }
    response.succeed = true;
    return response;
  });


  ipcMain.handle('cloud-download', async (event, data) => {

    const response = {
      succeed: false,
      ok: [],
      ko: []
    }

    if (!data || !data.data) {
      console.error("no cloud setting found");
      response.ko.push("no cloud setting found");
      return response;
    }

    const backupAbsDir = path.join(process.cwd(), CONFIG_FOLDER, BACKUP_FOLDER);
    const gitAbsDir = path.join(process.cwd(), CONFIG_FOLDER, GIT_FOLDER);

    let cloudSettings = data.data;

    let gitUser = encodeURIComponent(cloudSettings.login);
    let gitPassword = encodeURIComponent(cloudSettings.password);
    let gitRepoUrl = cloudSettings.url;
    gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
    gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

    let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

    try {
      // Step 1: Backup JSON files
      console.log('Backing up JSON files...');
      await fsPromise.rm(backupAbsDir, {recursive: true, force: true});
      await fsPromise.mkdir(backupAbsDir, {recursive: true});

      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const backupFilePath = path.join(backupAbsDir, fileName);

        try {
          await fsPromise.copyFile(file, backupFilePath);
          console.log(`Backed up: ${fileName}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            console.warn(`File not found (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }

      // Step 2: Delete existing Git folder
      console.log('Deleting existing Git folder...');
      await fsPromise.rm(gitAbsDir, {recursive: true, force: true});

      // Step 3: Clone the repository
      console.log('Cloning repository...');
      const git = simpleGit();
      await git.clone(gitRepoUrl, gitAbsDir);

      // Step 4: Replace JSON files in the Git folder
      console.log('Replacing JSON files ...');
      for (const file of jsonFiles) {
        const fileName = path.basename(file);
        const gitFilePath = path.join(gitAbsDir, fileName);

        try {
          // Check if the file exists in the cloned repo
          await fsPromise.access(gitFilePath);

          // Replace the file
          await fsPromise.copyFile(gitFilePath, file);
          response.ok.push('<->' + fileName);
          console.log(`Replaced in Git repo: ${fileName}`);
        } catch (err) {
          if (err.code === 'ENOENT') {
            console.warn(`File not found in Git repo (skipping): ${fileName}`);
          } else {
            throw err;
          }
        }
      }

      console.log('Operation completed successfully.');
    } catch (error) {
      console.error('Error:', error.message);
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
    const configAbsDir = path.join(process.cwd(), CONFIG_FOLDER);
    const result = [];
    for (const item of items) {
      if (item.toLowerCase() === 'Setting'.toLowerCase()) {
        result.push(path.join(configAbsDir,SETTINGS_JSON));
      }
      if (item.toLowerCase() === 'Profile'.toLowerCase()) {
        result.push(path.join(configAbsDir,PROFILES_JSON));
      }
      if (item.toLowerCase() === 'Secret'.toLowerCase()) {
        result.push(path.join(configAbsDir,SECRETS_JSON));
      }
    }
    return result;
  }

}

module.exports = { initCloudIpcHandler };
