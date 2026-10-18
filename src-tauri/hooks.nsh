; Omnitome NSIS Installer Hooks
; Displays notice informing the user of the 1-2 minute first-launch unpacking process

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
  MessageBox MB_OK|MB_ICONINFORMATION /SD IDOK "Omnitome has been installed. Note: The first time you launch the app, it will take 1-2 minutes to unpack the neural engine."
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend

