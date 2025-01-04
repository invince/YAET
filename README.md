# yetAnotherElectronTerm

This project is based on angular + electron to create a remote connection tool supporting SSH RDP SCP VNC
## Prerequisites
  - Node
  - angular cli
  - to compile module used in electron code: ```npm install --global --production windows-build-tools```
   
## Before you start
  - open a admin terminal (because we'll create some symbolic link, you need admin right for the 1st time) run first ```npm run build```

## Local DEV
  - ```npm run start``` to do local dev
  - or ```npm run ng:serve``` and ```npm run electron:dev``` separately
  - If you install some modules used by electron, you need run ```electron-rebuild```

## Package the installer
  - ```npm run build```

## Release
  - ```npm run release```
  - this will increment the version, package the installer, push to github (so auto updater can check the latest version)
  - NOTE: you still need push code your self
  - NOTE: also the pushed release is a pre-release, you need approve it

## NOTE:
  - code is pushed to self-hosted gitea
  - the release is pushed to github
