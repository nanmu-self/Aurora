# Aurora

> 深空有极光，写作有此处。

Aurora 是一款**本地优先**的桌面 Markdown 编辑器，使用 Tauri 2 + SvelteKit 构建。
文件就是普通的 `.md`，躺在用户自己的文件夹里 —— 没有私有格式，没有云端锁定。

![Aurora](docs/screenshot-placeholder.png)

## 特性

- **工作区模式** — 打开文件夹即笔记库：树形浏览、懒加载、行内新建/重命名、删除进废纸篓
- **多标签编辑** — 每个标签独立撤销栈与光标位置，切换零损耗
- **分栏实时预览** — 块级增量渲染，大文档也流畅；GFM 表格 / 任务列表 / KaTeX 公式 / 代码高亮
- **双向滚动同步** — 源码行号锚点 + 线性插值，不是粗糙的百分比滚动
- **图片粘贴即落盘** — 截图直接 Cmd+V 存入 `assets/` 并插入相对引用（经 asset 协议安全渲染）
- **中文写作优先** — IME 组字全程不打断、中西文自动间距、CJK 字数统计与阅读时长
- **自动保存 + 外部变更感知** — 防抖静默保存；外部修改自动重载或冲突提示（三层防环）
- **全局搜索** — 工作区内 md/txt 全文搜索，点击直达命中行
- **导出 HTML** — 自包含单文件、打印友好样式，可另存为 PDF
- **深空 / 晨雾双主题** — 极光渐变点缀，跟随系统切换

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Cmd+N` | 新建缓冲区 |
| `Cmd+O` | 打开文件 |
| `Cmd+Shift+O` | 打开工作区 |
| `Cmd+S` / `Cmd+Shift+S` | 保存 / 另存为 |
| `Cmd+W` | 关闭标签页 |
| `Cmd+F` | 查找替换 |
| `Cmd+Shift+F` | 工作区全局搜索 |
| `Cmd+B` / `Cmd+I` / `Cmd+E` | 加粗 / 斜体 / 行内代码 |
| `Cmd+K` | 插入链接 |
| `Cmd+Shift+E` | 导出 HTML |
| `Cmd+\` | 显示 / 隐藏侧栏 |
| `Cmd+1` / `Cmd+2` / `Cmd+3` | 仅编辑区 / 分栏 / 仅预览区 |
| `Cmd+=` / `Cmd+-` / `Cmd+0` | 预览放大 / 缩小 / 实际大小（也支持 Cmd+滚轮、触控板双指捏放） |

## 开发

```bash
pnpm install        # 安装依赖
pnpm tauri dev      # 开发运行（首次会编译 Rust，需几分钟）
pnpm check          # svelte-check 类型检查
pnpm build          # 仅构建前端
```

打包发布：

```bash
pnpm tauri build    # 产出 .app / .dmg（macOS）及对应平台安装包
```

产物位于 `src-tauri/target/release/bundle/`。签名与公证需要配置 Apple Developer
证书（`APPLE_SIGNING_IDENTITY`），未签名时本地右键「打开」即可运行。

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | Tauri 2（Rust） |
| 前端 | SvelteKit 2 SPA · Svelte 5 runes · TypeScript |
| 编辑器 | CodeMirror 6 |
| Markdown 渲染 | unified / remark + rehype（GFM · KaTeX · highlight.js） |
| 文件监听 | notify |

架构原则：所有磁盘 IO 走 Rust command；正文唯一事实源是 CM6 的 `EditorState`；
预览块级增量渲染。详细设计见 [docs/execution-plan.md](docs/execution-plan.md)。

## Roadmap

- [x] M0-M3：基建 / 编辑闭环 / 工作区 / 写作体验（见执行计划）
- [x] M4：设置页 · 导出 HTML · 全局搜索 · 打包
- [ ] 所见即所得模式评估
- [ ] PDF 直接导出（跨平台打印管线差异待验证）
- [ ] 中文排版细节：标点悬挂、中西文间距设置项
- [ ] 双链与知识图谱（远期）

## License

MIT
