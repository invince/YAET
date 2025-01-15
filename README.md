# yetAnotherElectronTerm

YAET is a remote connection tool based on angular + electron supporting SSH RDP SCP/SFTP FTP VNC

## Prerequisites
- Node
- angular cli
- to compile module used in electron code: ```npm install --global --production windows-build-tools```

## Before you start
- open an admin terminal (because we'll create some symbolic link, you need admin right for the 1st time) run first ```npm run build```
- create config/config.json, put your syncfusion key inside config.json 

## Local DEV
- ```npm run start``` to do local dev
- or ```npm run ng:serve``` and ```npm run electron:dev``` separately
- If you install some modules used by electron, you need run ```electron-rebuild```

## Package the installer
- ```npm run build```

## Release
- you need setup the github token in environment variable GH_TOKEN for this script
- ```npm run release```
- this will increment the version, package the installer, push to github (so auto updater can check the latest version)
- NOTE: you still need push code your self
- NOTE: also the pushed release is a pre-release, you need approve it
- released package please cf https://github.com/invince/YAET-RELEASE

# Log:
- on Linux: ~/.config/{app name}/logs/main.log
- on macOS: ~/Library/Logs/{app name}/main.log
- on Windows: %USERPROFILE%\AppData\Roaming\{app name}\logs\main.log



