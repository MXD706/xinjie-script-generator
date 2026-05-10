# 昕昕分镜脚本生成器

> 多场景 AI 分镜工坊：旅游 Vlog · 口播知识 · 日常分享。一键生成可拍摄的分镜表 + 发布物料，支持提词器、字幕导出、离线使用。

**在线地址**：https://mxd706.github.io/xinjie-script-generator/

## 核心功能

### 多场景
- 🧳 **旅游 Vlog**：目的地/交通/住宿/行程细节 → 4 种叙事模板
- 🎙 **口播知识**：主题/观点/论据 → 反共识/经验/测评/吐槽
- 💭 **日常分享**：场景/情绪/细节 → 一日流水/小确幸/观察/吐槽

### AI 生成
- ⚡ DeepSeek 流式生成，边写边显示已解析镜头数
- 🔄 一键重新生成整条 / 再短 10 秒 / 再加 2 个镜头
- 🎯 单镜头重写，保留其他
- 🎨 可自定义三种场景的 SYSTEM_PROMPT

### 分镜编辑
- ✏️ 编辑模式开关，默认只读避免误触
- ➕ 增删、上下移、拖拽
- ↶ Undo / Redo（⌘Z / ⌘⇧Z）
- ☑️ 拍摄完成打勾，进度追踪
- ⚠️ 口播字数/总时长自动校验

### 发布物料
- 📌 自动生成 3 个备选标题
- 💬 配套发布文案（60-120 字）
- 🏷 话题（5-8 个 #）
- 🎨 封面大字建议 + 推荐封面镜头

### 现场工具
- 📣 **提词器模式**：全屏大字、左右滑切换、字号调节、镜像
- 💡 **选题库**：每场景 10+ 灵感卡片一键填入
- 🎤 **合并口播**：一键复制整段，丢进剪映做字幕
- 💬 **SRT 字幕导出**：直接导入剪映/PR
- 📋 **拍摄清单**：纯摄影师视角，去现场用

### 导出 / 分享
- 📝 Markdown（完整，含发布物料）
- 💬 SRT 字幕（剪辑可直接导入）
- 📄 PDF / 长图（微信也能保存）
- 🔗 分享链接（gzip 压缩的 base64）
- 💾 完整备份 JSON（一键迁移）

### 质量保障
- ⚠️ 敏感词/引流词检测（微信号、VX、政治敏感、绝对化用语等）
- 📏 字数/时长比 > 5 字/秒 警告（念不完）
- 🧮 镜头时长总和 vs 总时长对账

### 体验
- 🌓 深色 / 浅色 / 自动主题
- ⌘K 命令面板（所有功能秒搜）
- ⌘⏎ 生成 · ⌘S 导出 MD · ⌘Z/⌘⇧Z 撤销/重做
- ⭐ 历史收藏（不占 30 条上限）
- 🔍 历史搜索
- 🕶 无痕模式（不写任何历史/草稿）
- 📱 PWA：桌面安装、离线访问、新版本提示

### 隐私 / 安全
- 🔒 API Key 与历史仅存在你本地浏览器，不上传任何服务器
- 🛡 严格 CSP（仅允许访问 DeepSeek）
- ✅ Key 有效性测试按钮

## 使用

1. 打开在线地址
2. 去 [DeepSeek](https://platform.deepseek.com/api_keys) 申请 API Key
3. 右上 🔑 设置 → 填入 Key → 点"测试"确认有效
4. 顶部选择场景（旅游/口播/日常）
5. 可以点"💡 选题库"一键填入灵感，或手动填写
6. ⌘⏎ 生成
7. 现场拍摄时 ⌘K → "提词器模式"

## 本地开发

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建生产包到 dist/
npm run preview  # 预览生产构建
```

## 部署

推到 `main` 分支会自动触发 GitHub Actions 部署到 GitHub Pages。仓库 Settings → Pages → Source 需设为 **GitHub Actions**。

## 架构

```
src/
  App.tsx               主组件
  templates.ts          三种场景的字段定义 + prompt 模板
  types.ts              所有 TypeScript 类型
  storage.ts            localStorage 封装 (history/draft/key/settings)
  deepseek.ts           API 调用（流式、重试、Key 测试）
  parser.ts             解析器（shots/meta/notes/publish kit/校验）
  exporters.ts          导出（PDF/长图/MD/SRT/拍摄清单）
  sensitive.ts          敏感词/引流词检测
  share.ts              分享链接（gzip + base64url）
  components/
    Teleprompter.tsx    提词器全屏模式
    CommandPalette.tsx  ⌘K 命令面板
    UpdatePrompt.tsx    SW 新版本提示
```

## 技术栈

- React 18 + TypeScript
- Vite
- jspdf / html2canvas（动态导入，仅在导出时加载）
- Service Worker（离线 + 缓存 + 新版本检测）
- 无后端，无第三方依赖（除 DeepSeek API）

## License

MIT
