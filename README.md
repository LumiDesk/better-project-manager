<div align="center">

<img src="resources/logo.png" alt="Better Project Manager" width="96" />

# Better Project Manager

一个用于管理多个项目的 **VS Code 扩展** —— 添加、组织、快速访问你的项目。

![Version](https://img.shields.io/badge/version-0.1.5-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-green)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.100.0-007ACC?logo=visual-studio-code&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

</div>

---

## ✨ 功能特性

- 🗂️ **项目管理** —— 添加、保存当前文件夹、打开、重命名、删除项目
- 📁 **文件夹分组** —— 按文件夹整理项目，支持拖拽跨文件夹移动
- 🎨 **自定义图标** —— 项目与文件夹都支持 `SVG / PNG / JPG / JPEG` 图标
- 🖥️ **多窗口打开** —— 在当前窗口或新窗口打开项目
- 🔍 **快速搜索** —— 按名称 / 路径 / 文件夹模糊定位并打开
- ⚠️ **失效提示** —— 路径失效的项目自动标黄提醒
- 🚀 **新手引导** —— 首次使用提供交互式引导，空列表时也有入口

## 📦 安装

1. 打开 VS Code，进入扩展面板（`Ctrl+Shift+X`）
2. 搜索 **"Better Project Manager"**
3. 点击 **安装**
4. 安装后点击左侧活动栏的「项目管理器」图标即可使用

> 也可以从 [Releases](https://github.com/Talyra42/better-project-manager/releases) 下载 `.vsix` 文件手动安装。

## 🚀 快速上手

| 操作 | 方式 |
|---|---|
| 保存当前文件夹 | 侧边栏标题栏「保存」按钮（或右键菜单） |
| 添加项目 | 侧边栏标题栏「➕」按钮，选择文件夹即可 |
| 打开项目 | 单击项目（当前窗口）/ 右键「在新窗口打开」 |
| 移动分组 | 直接拖拽项目到目标文件夹 |
| 搜索项目 | 侧边栏标题栏「🔍」按钮 |
| 设置图标 | 右键项目 / 文件夹 →「修改图标」 |

## ⚙️ 配置项

| 配置 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `betterProjectManager.showProjectPath` | `boolean` | `true` | 是否在项目名下方显示路径 |
| `betterProjectManager.showDefaultProjectIcon` | `boolean` | `true` | 是否显示默认的项目图标 |

在设置中搜索 **"Better Project Manager"** 即可修改。

## 📄 数据存储

- 项目列表存储在 VS Code 全局存储目录下的 `project-manager.json`
- 文件夹配置存储在 `folder-config.json`
- 自定义图标文件复制到同一目录，删除项目 / 重置图标时会自动清理不再使用的图标

可通过侧边栏标题栏的「编辑配置文件」命令直接打开。

## 🛠 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![VS Code API](https://img.shields.io/badge/VS%20Code%20API-1.100-007ACC?logo=visual-studio-code&logoColor=white)
![esbuild](https://img.shields.io/badge/esbuild-0.25-FFCF00?logo=esbuild&logoColor=black)
![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?logo=eslint&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)

## 🧑‍💻 本地开发

```bash
pnpm install        # 安装依赖
pnpm run compile    # 类型检查 + lint + 打包
```

在 VS Code 中打开项目，按 **F5** 启动扩展开发宿主进行调试。

## 📄 许可证

[GPL-3.0](./LICENSE) © Talyra42
