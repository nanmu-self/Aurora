; Aurora NSIS 安装器钩子（tauri-bundler 在模板对应位置展开这些宏）。
; 注意：卸载提示按所选语言分流（简体中文语言 ID 为 2052）。

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $LANGUAGE == 2052
    MessageBox MB_ICONINFORMATION \
      "即将卸载 Aurora。$\r$\n$\r$\n你的设置、最近工作区等用户数据保留在：%APPDATA%\com.zhang.aurora$\r$\n卸载不会删除这些数据；如需彻底清理，可稍后手动删除该目录。"
  ${Else}
    MessageBox MB_ICONINFORMATION \
      "Aurora is about to be uninstalled.$\r$\n$\r$\nYour settings and recent workspaces are kept in:%APPDATA%\com.zhang.aurora$\r$\nThe uninstaller will not remove them. Delete the folder manually if you want a full cleanup."
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; 安装完成不做额外动作：启动应用、快捷方式等由安装完成页的复选框负责
!macroend
