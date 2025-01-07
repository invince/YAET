# Define a custom uninstall process
Function un.customUnInstall
  # Retrieve the USERPROFILE environment variable
  ExpandEnvStrings $0 "%USERPROFILE%"
  StrCpy $0 "$0\.yaet"

  # Check if the directory exists
  IfFileExists "$0\*" 0 un.EndUninstall

  # Ask the user whether to delete the configuration files
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to keep your configuration files located at '$0'?" IDNo un.DeleteConfig

  # User chose "Yes"
  Goto un.EndUninstall

  # User chose "No"
  un.DeleteConfig:
    RmDir /r "$0"

  un.EndUninstall:
FunctionEnd

# Link the customUnInstall function to the uninstaller
Section "Uninstall"
  Call un.customUnInstall
  RmDir /r "$INSTDIR"
SectionEnd
