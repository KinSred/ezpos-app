!macro preInit
  ; Check if already installed in HKCU (current user)
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ezpos.app" "UninstallString"
  StrCmp $R0 "" checkMachine
    MessageBox MB_YESNO|MB_ICONQUESTION "Ứng dụng EZPOS đã được cài đặt trên máy tính. Bạn có muốn tiếp tục chạy cài đặt để cập nhật/cài đè không?$\r$\n$\r$\nEZPOS is already installed on your system. Do you want to continue to update/overwrite?" IDYES +2
    Quit
  checkMachine:
  ; Check if already installed in HKLM (all users)
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ezpos.app" "UninstallString"
  StrCmp $R0 "" done
    MessageBox MB_YESNO|MB_ICONQUESTION "Ứng dụng EZPOS đã được cài đặt trên máy tính. Bạn có muốn tiếp tục chạy cài đặt để cập nhật/cài đè không?$\r$\n$\r$\nEZPOS is already installed on your system. Do you want to continue to update/overwrite?" IDYES done
    Quit
  done:
!macroend
