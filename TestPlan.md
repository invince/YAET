# General
- start app without any setting files
- start app with setting files
- multiple message can be displayed one by one (for ex, when you change master key and re-encrypt all settings)
- dev mode has menu
- prod mode no menu
- mouse middle-click the title of the tab trigger close of the tab

## Package
- local dev mode ok
  - either run npm run ng:serve + npm run electron:dev
  - or run npm run start
- package script ok
  - can create local installer
- release script ok
  - can push installer to github for autoupdate check
  - increment package json version

## Auto Update
- if dev mode, no auto update should happen
- if prod mode, and auto update option checked, then auto update should start (check log)
- if prod mode, and auto update option is not checked, then auto update should not start (check log)

## Master Key
- if no master key configured, when you click cloud, profile, secret, quickconnect button, popup to suggest you set master key should appear
  - NOTE: we'll update the key, but we shall not display the re-encrypt popup
- when change master key, if you set the correct old master key, a popup to suggest you re-encrypt all settings should appear
  - click ok, all will be re-encrypted
  - click cancel, nothing happens
- when change master key, if you set the incorrect old master key, all encrypted settings go to void
  - NOTE: we'll update the key to new key, but we shall not display the re-encrypt popup

# Setting Menu
- all page validation ok (save button disable enable correctly)
- can add group
- can edit group
- can delete group
  - if this group contains profile, after delete, that profile should go to default group
- can add tags
- can edit tags
- can delete tags
  - if exists profile contains this tag, after delete, this tag should be removed for that profile
- if not compatible settings loaded, info message will display and the settings is initialized 
  - cloud
  - profile
  - secrets
  - settings

# Add Local Term Menu
- every time you click local terminal button at sidenav, a local terminal should start

# Quick connect menu
- quick connect setting form works well (cf profiles menu)
- be able to connect
- be able to save to profile

# Profiles menu
- group tree view ok
  - group color displays
  - each item has tag color
  - order by name
  - profile icon ok
- list view ok
  - each item has tag color
  - order by name
  - profile icon ok
- default is group tree
- filter works
- new profile works
  - custom
  - ssh
  - vnc
  - rdp
  - scp
  - ftp
  - icon ok
- clone works
  - custom
  - ssh
  - vnc
  - rdp
  - scp
  - ftp
  - with same group info cloned
  - with same tags info cloned
- edit
  - if change type of the profile, icon changes too
  - basic change ok
  - change group ok
  - change tag change also the color icon
- delete ok


# Secrets module
- add
  - pass only
  - login pass
  - key without passphrase
  - key with passphrase
  - duplicate check ok
- edit
  - change type ok
  - rename ok
  - duplicate check ok
- delete
  - associate profile set cleared
- icon ok
- icon ok in dropdown of
  - cloud settings
  - ssh/scp profile settings
  - vnc profile settings
- in cloud drop down of secret, click add new opens a quick secret creation page with only login password type
- in ssh/scp drop down of secret, click add new opens a quick secret creation page with all type
- in vnc drop down of secret, click add new opens a quick secret creation page with only password only type
  - new secret creation has same validator
  - new secret can be created
  - after creation, it appears in the dropdown
  - if only one possible secretType option, that one will be selected by default

# Cloud menu
- form validation ok
- upload ok
- download ok

# Terminal
- reconnect: open a ssh terminal, reboot, then the reconnect button should appear
  - after you click it, your session should be reconnected

## Local Terminal
- (Settings) if default open option checked, then a local terminal should start at startup
- (Settings) if default open option not checked, then a local terminal should not start at startup
- cmd powershell work in terminal
- (Settings) be able to switch between cmd, powershell, powershell7, bash for local terminal

## Telnet
- be able to configure a telnet connection
- be able to launch command on that telnet connection
- NOTE: win11 doesn't support telnet server anymore, you need install a server yourself for ex: hk-telnet-server

## WinRM (powershell)
- be able to configure a winrm connection
- be able to launch command on that winrm connection
- NOTE: you may need run following cmd on your client post
  - ```winrm quickconfigure```
  - if you use http user authentication, you need add the winrm server into your trustedHost config
  - ```winrm set winrm/config/client '@{TrustedHosts="machineA,machineB"}'```
- for ssh type WinRM please use ssh connection in the below part

## SSH
- connection ok
- color ok
- cmd works
- vi works
- scrollbar works
- clipboard works (ctrl shift c for copy, ctrl v or mouse right click for paste)
- init path ok
- init command ok
- resize ok

# Remote Desktop

## Rdp
- open mstsc

## VNC
- connection ok
- copy paste text ok
- resize ok

# Remote File explorer

## SCP
- all ok, use a third party lib
- init path pb fixed via patch-package
- [x] scp form
- [x] connect
- [x] list
- [x] cd
- [x] download single
- [x] download multiple
- [x] details
- [x] upload
- [x] drag and drop file to upload
- [x] copy paste file
- [x] cut paste file
- [x] create folder
- [] create file
- [x] rename folder
- [x] rename file
- [x] delete file
- [x] delete folder
- [x] double click open the file 
  - if you update the file, the file will be uploaded to scp

## Ftp
- [x] profile form
- [x] connect
- [x] list
- [x] cd
- [x] download single
- [x] download multiple
- [x] upload
- [x] drag and drop file to upload
- [x] init path
- [x] create folder
- [] create file
- [x] rename folder
- [x] rename file
- [x] delete file
- [x] delete folder
- [x] double click open the file
  - if you update the file, the file will be uploaded to ftp

# Custom
- custom command can start, for ex for realvnc
