# 昕昕分镜脚本生成器

> 填真实拍摄信息 → AI 一键产出可直接拍摄的分镜表。支持导出 PDF、长图、Markdown，可离线使用。

**在线地址**：https://mxd706.github.io/xinjie-script-generator/

## 功能

- 🎬 按"昕昕"人设（台湾女生在大陆）生成抖音旅行分镜
- ⚡ DeepSeek 流式生成，边写边显示
- 📋 4 种爆款模板一键选（冲动行动 / 对比发现 / 情感走心 / 体验分享）
- ⏱ 支持 28s / 45s / 60s 时长选择
- ✏️ 每个镜头可编辑、删除、上下移动
- 🔁 单镜头重新生成
- 📎 自动保存表单草稿
- 🔗 一键分享链接（脚本编码进 URL，不走服务器）
- 📥 导出 PDF / 长图 / Markdown
- 📱 PWA 支持，可安装到桌面，离线查看历史
- 🔒 API Key 与历史记录仅存储在你本地浏览器，不上传任何服务器

## 使用

1. 打开在线地址
2. 去 [DeepSeek](https://platform.deepseek.com/api_keys) 申请一个 API Key
3. 在页面点"🔑 设置 API Key"填入
4. 填写目的地和去干什么（其他字段选填，填得越细越准）
5. 点"生成分镜脚本"

## 本地开发

```bash
npm install
npm run dev      # 开发模式
npm run build    # 构建生产包到 dist/
npm run preview  # 预览生产构建
```

## 部署

推到 `main` 分支会自动触发 GitHub Actions 部署到 GitHub Pages。仓库 Settings → Pages → Source 需设为 **GitHub Actions**。

## 技术栈

React 19 · TypeScript · Vite · jsPDF · html2canvas · DeepSeek API
