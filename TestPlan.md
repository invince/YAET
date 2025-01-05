# Common Module
- start app without any setting files
- start app with setting files
- multiple message can be displayed one by one (for ex, when you change master key and re-encrypt all settings)

# Setting
- all page validation ok (save button disable enable correctly)
- can add group
- can edit group
- can delete group
  - if this group contains profile, after delete, that profile should go to default group
- can add tags
- can edit tags
- can delete tags
  - if exists profile contains this tag, after delete, this tag should be removed for that profile
- if not compatible settings loaded, info message will display and the settings is initialized (cloud, profile, secrets, settings)


# Master Key
- if no master key configured, when you click cloud, profile, secret, quickconnect button, popup to suggest you set master key should appear
  - NOTE: we'll update the key, but we shall not display the re-encrypt popup 
- when change master key, if you set the correct old master key, a popup to suggest you re-encrypt all settings should appear
  - click ok, all will be re-encrypted
  - click cancel, nothing happens
- when change master key, if you set the incorrect old master key, all encrypted settings go to void
  - NOTE: we'll update the key to new key, but we shall not display the re-encrypt popup

# Auto Update
- if dev mode, no auto update should happen
- if prod mode, and auto update option checked, then auto update should start (check log)
- if prod mode, and auto update option is not checked, then auto update should not start (check log)

# Local Terminal
- (Settings) if default open option checked, then a local terminal should start at startup
- (Settings) if default open option not checked, then a local terminal should not start at startup
- every time you click local terminal button at sidenav, a local terminal should start
- cmd works in terminal
- (Settings) be able to switch between cmd, powershell for local terminal

# Quick connect menu
- quick connect setting form works well (cf profiles menu)
- be able to connect
- be able to save to profile

