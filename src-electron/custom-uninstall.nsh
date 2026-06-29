!macro customUnInstall
  ExpandEnvStrings $0 "%USERPROFILE%"
  StrCpy $0 "$0\.yaet"
  StrCpy $2 "$0\plugins"

  ; No .yaet directory? Nothing to ask.
  IfFileExists "$0\*" 0 un.EndUninstall

  ; Prompt 1: Keep config files?
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to keep your configuration files at '$0'?" \
    IDNo un.DeleteConfig
  Goto un.CheckPlugins

  un.DeleteConfig:
    RmDir /r "$0"

  un.CheckPlugins:
  ; Prompt 2: Keep external plugins?
  IfFileExists "$2\*" 0 un.EndUninstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to keep your external plugins at '$2'?" \
    IDNo un.DeletePlugins
  Goto un.EndUninstall

  un.DeletePlugins:
    RmDir /r "$2"

  un.EndUninstall:
!macroend
