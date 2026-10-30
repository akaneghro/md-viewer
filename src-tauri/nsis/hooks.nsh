; The bundler registers the file association under the ProgID set in
; tauri.conf.json (bundle > fileAssociations > name).
!define MDVIEWER_PROGID "MDViewer.Markdown"

!macro NSIS_HOOK_POSTINSTALL
  ; Override the default icon for Markdown file associations
  ; to use a dedicated .ico file instead of the exe resource
  WriteRegStr SHELL_CONTEXT "Software\Classes\${MDVIEWER_PROGID}\DefaultIcon" "" "$INSTDIR\resources\markdown.ico"
  !insertmacro UPDATEFILEASSOC
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; The bundler removes the ProgID on uninstall; delete it again in case the
  ; icon override outlived it, then refresh Explorer's icon cache
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${MDVIEWER_PROGID}"
  !insertmacro UPDATEFILEASSOC
!macroend
