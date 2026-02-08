!macro NSIS_HOOK_POSTINSTALL
  ; Override the default icon for Markdown file associations
  ; to use a dedicated .ico file instead of the exe resource
  WriteRegStr SHELL_CONTEXT "Software\Classes\Markdown\DefaultIcon" "" "$INSTDIR\resources\markdown.ico"
  !insertmacro UPDATEFILEASSOC
!macroend
