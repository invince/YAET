# Yet Another Electron Terminal

## Description
YAET is a remote connection tool based on angular + electron supporting 
  - Terminal: SSH, Telnet, WinRM
  - Remote Desktop: VNC, RDP
  - Remote File Explorer: SCP/SFTP FTP SAMBA
  - Custom command

With a password management, and cloud sync function.


## Prerequisites
- Node.js (v20.19+ or v22.12+ or v24+)
- Angular CLI
- Python 3.x (for native module compilation)
  - **Important**: If using Python 3.12+, you must install setuptools: `pip install setuptools`
- Visual Studio Build Tools with "Desktop development with C++" workload (Windows)
  - Or: `npm install --global --production windows-build-tools` (legacy method)

## Before you start
- Open an admin terminal (symbolic links require admin rights on first run)
- Run `npm install` to install dependencies
- If native modules fail to build, run `npm run rebuild-native`
- Create `config/config.json` and add your Syncfusion key

## Local DEV
- `npm run start` to run development mode
- Or `npm run ng:serve` and `npm run electron:dev` separately
- If you install modules used by Electron, run `npm run rebuild-native`

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



