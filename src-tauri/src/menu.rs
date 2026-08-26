//! macOS 顶部菜单栏（中文）。
//!
//! 设计要点：
//! - 编辑类动作使用 `PredefinedMenuItem` 并覆盖中文标签 —— 行为仍走系统响应链
//!   （performCut:/performPaste: 等），因此粘贴图片、IME、撤销栈都保持原生表现；
//! - 文件类动作是自定义项，通过 `on_menu_event` 转发到前端已有的处理函数；
//! - 退出用自定义项而非预定义 quit，确保一定经过前端的「未保存保护」确认流程。

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};

/// 视图菜单里的勾选项句柄：前端状态变化后经 `sync_view_menu` 回写勾选态。
pub struct ViewMenuItems {
    sidebar: CheckMenuItem<Wry>,
    mode_split: CheckMenuItem<Wry>,
    mode_editor: CheckMenuItem<Wry>,
    mode_preview: CheckMenuItem<Wry>,
}

/// 由前端 $effect 调用，保持菜单勾选与界面一致。
#[tauri::command]
pub fn sync_view_menu(app: AppHandle, mode: String, sidebar_visible: bool) -> Result<(), String> {
    let items = app
        .try_state::<ViewMenuItems>()
        .ok_or_else(|| "菜单尚未初始化".to_string())?;
    let set = |item: &CheckMenuItem<Wry>, checked: bool| {
        item.set_checked(checked)
            .map_err(|e| format!("更新菜单勾选失败：{e}"))
    };
    set(&items.sidebar, sidebar_visible)?;
    set(&items.mode_split, mode == "split")?;
    set(&items.mode_editor, mode == "editor")?;
    set(&items.mode_preview, mode == "preview")?;
    Ok(())
}

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    /* ---------------- Aurora（应用菜单） ---------------- */
    let about = PredefinedMenuItem::about(app, Some("关于 Aurora"), None)?;
    let settings = MenuItem::with_id(app, "app.settings", "设置…", true, Some("CmdOrCtrl+,"))?;
    let hide = PredefinedMenuItem::hide(app, Some("隐藏 Aurora"))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?;
    let quit = MenuItem::with_id(app, "app.quit", "退出 Aurora", true, Some("CmdOrCtrl+Q"))?;
    let app_menu = Submenu::with_items(
        app,
        "Aurora",
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &hide,
            &hide_others,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    /* ---------------- 文件 ---------------- */
    let new_file = MenuItem::with_id(app, "file.new", "新建", true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(app, "file.open", "打开…", true, Some("CmdOrCtrl+O"))?;
    let open_ws = MenuItem::with_id(
        app,
        "file.workspace",
        "打开工作区…",
        true,
        Some("Shift+CmdOrCtrl+O"),
    )?;
    let save = MenuItem::with_id(app, "file.save", "保存", true, Some("CmdOrCtrl+S"))?;
    let save_as = MenuItem::with_id(
        app,
        "file.save_as",
        "另存为…",
        true,
        Some("Shift+CmdOrCtrl+S"),
    )?;
    let export = MenuItem::with_id(
        app,
        "file.export",
        "导出 HTML…",
        true,
        Some("Shift+CmdOrCtrl+E"),
    )?;
    let close_tab = MenuItem::with_id(app, "file.close_tab", "关闭标签页", true, Some("CmdOrCtrl+W"))?;
    let file_menu = Submenu::with_items(
        app,
        "文件",
        true,
        &[
            &new_file,
            &open_file,
            &open_ws,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &export,
            &PredefinedMenuItem::separator(app)?,
            &close_tab,
        ],
    )?;

    /* ---------------- 编辑（预定义动作 + 中文标签） ---------------- */
    let find = MenuItem::with_id(app, "edit.find", "查找…", true, Some("CmdOrCtrl+F"))?;
    let search_ws = MenuItem::with_id(
        app,
        "edit.search_workspace",
        "在工作区中搜索…",
        true,
        Some("Shift+CmdOrCtrl+F"),
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("撤销"))?,
            &PredefinedMenuItem::redo(app, Some("重做"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("拷贝"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
            &PredefinedMenuItem::separator(app)?,
            &find,
            &search_ws,
        ],
    )?;

    /* ---------------- 格式（Markdown 标记） ---------------- */
    let bold = MenuItem::with_id(app, "fmt.bold", "加粗", true, Some("CmdOrCtrl+B"))?;
    let italic = MenuItem::with_id(app, "fmt.italic", "斜体", true, Some("CmdOrCtrl+I"))?;
    let code = MenuItem::with_id(app, "fmt.code", "行内代码", true, Some("CmdOrCtrl+E"))?;
    let link = MenuItem::with_id(app, "fmt.link", "插入链接", true, Some("CmdOrCtrl+K"))?;
    let format_menu =
        Submenu::with_items(app, "格式", true, &[&bold, &italic, &code, &link])?;

    /* ---------------- 视图 ---------------- */
    let sidebar = CheckMenuItem::with_id(
        app,
        "view.sidebar",
        "显示侧栏",
        true,
        true,
        Some("CmdOrCtrl+\\"),
    )?;
    let mode_editor = CheckMenuItem::with_id(
        app,
        "view.mode.editor",
        "仅编辑区",
        true,
        false,
        Some("CmdOrCtrl+1"),
    )?;
    let mode_split =
        CheckMenuItem::with_id(app, "view.mode.split", "分栏", true, true, Some("CmdOrCtrl+2"))?;
    let mode_preview = CheckMenuItem::with_id(
        app,
        "view.mode.preview",
        "仅预览区",
        true,
        false,
        Some("CmdOrCtrl+3"),
    )?;
    let toggle_theme = MenuItem::with_id(app, "view.theme", "切换深浅主题", true, None::<&str>)?;
    let view_menu = Submenu::with_items(
        app,
        "视图",
        true,
        &[
            &sidebar,
            &PredefinedMenuItem::separator(app)?,
            &mode_editor,
            &mode_split,
            &mode_preview,
            &PredefinedMenuItem::separator(app)?,
            &toggle_theme,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?,
        ],
    )?;

    // 句柄交给 Tauri 状态管理，供 sync_view_menu 回写勾选态
    app.manage(ViewMenuItems {
        sidebar,
        mode_split,
        mode_editor,
        mode_preview,
    });

    /* ---------------- 窗口 ---------------- */
    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::separator(app)?,
            // 关闭窗口走系统 performClose:，会触发前端的未保存保护
            &PredefinedMenuItem::close_window(app, Some("关闭窗口"))?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &format_menu,
            &view_menu,
            &window_menu,
        ],
    )
}
