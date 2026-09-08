# Better Project Manager — 开发文档 & 迭代计划

> 分支：`refactor/modernize`
> 基线版本：`0.1.5`
> 文档日期：2026-09-08

## 迭代进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 基线与环境（引擎/类型升级、manifest 清理、pnpm 统一） | ✅ 完成 |
| Phase 1 | Webview CSP 与内联脚本/样式抽离 | ✅ 完成 |
| Phase 2 | Bug 修复（配置默认值 / 路径比较 / UUID / 孤儿图标 / 重复检测 / 文件监视 / 资源清理） | ✅ 完成 |
| Phase 3 | 空状态引导、失效路径提示、tooltip、搜索并打开项目 | ✅ 部分完成 |
| Phase 3 | 排序方式、收藏置顶、批量操作、快捷键 | ⏳ 待做 |
| Phase 4 | 新手引导改造 | ⏳ 待做 |
| 代码质量 | 命令注册精简、添加/保存流程去重、单元测试 | ⏳ 待做 |

本文档记录对项目的 Code Review 结论，以及后续迭代计划。分为五个部分：

1. [环境与版本基线](#一环境与版本基线)
2. [Code Review 发现的问题](#二code-review-发现的问题)
3. [功能与 UX 改进](#三功能与-ux-改进)
4. [迭代计划](#四迭代计划)
5. [待决策事项](#五待决策事项)

---

## 一、环境与版本基线

| 项 | 当前 | 最新（2026-09-08） | 结论 |
|---|---|---|---|
| VS Code (`engines.vscode`) | `^1.100.0` | `1.136.1`（2026-09-03 发布） | 落后约 36 个 minor 版本 |
| `@types/vscode` | `^1.100.0` | `1.136.0` | 同上，需同步升级 |
| TypeScript | `^5.9.2` | — | 可用 |
| 包管理器 | scripts 用 `pnpm`，仓库有 `.yarnrc`，lock 文件全被 gitignore | — | 混用，需统一 |

升级 `engines.vscode` / `@types/vscode` 到较新版本（建议 `^1.136.0`，或退一步选一个较保守的近期版本），是本迭代的第一步，也是后续所有改动的前提。

---

## 二、Code Review 发现的问题

按「与最新规范不一致 / 代码缺陷 / 代码质量」三类组织。严重度：🔴 高 · 🟡 中 · 🟢 低。

### A. 与 VS Code 最新文档 / 规范不一致

| # | 严重度 | 问题 | 位置 | 修复方案 |
|---|---|---|---|---|
| A1 | 🔴 | **Webview 缺少 Content-Security-Policy**。官方文档要求 webview 在 `<head>` 顶部设置 `<meta http-equiv="Content-Security-Policy">`，且应 `default-src 'none'` 起步。当前 `OnboardingPanel` 同时使用内联 `<style>` 和内联 `<script>`，且无 CSP。 | `src/webview/OnboardingPanel.ts` | 加 CSP meta；将内联脚本/样式抽离，或按需用 `${webview.cspSource}` 放开 `script-src`/`style-src`。 |
| A2 | 🟡 | **版本基线严重滞后**，未使用近 36 个版本的新 API / 修复。 | `package.json` | 升级 `engines.vscode` 与 `@types/vscode` 到 `^1.136.0`。 |
| A3 | 🟢 | **`activationEvents: []` 冗余**。自 1.74 起，贡献的 command/view 会自动生成激活事件，空数组无实际作用。 | `package.json` | 直接移除该字段。 |
| A4 | 🟢 | **缺少 `capabilities` 声明**。该扩展只读写自身全局配置、打开真实本地文件夹，不适用于虚拟工作区 / 不受信工作区。 | `package.json` | 补 `capabilities`（`untrustedWorkspaces`、`virtualWorkspaces`），避免在不适用环境被误启用。 |

### B. 代码缺陷 / Bug

| # | 严重度 | 问题 | 位置 | 修复方案 |
|---|---|---|---|---|
| B1 | 🟡 | **配置默认值不一致**：manifest 里 `showProjectPath` 默认 `false`，但代码里 `.get("showProjectPath", true)` 兜底 `true`。用户未显式设置时，实际行为与声明相反。 | `package.json:208` vs `src/providers/ProjectTreeProvider.ts:73-75` | 统一默认值（建议默认 `true`，显示路径更符合直觉），并同步两处。 |
| B2 | 🟡 | **孤儿图标文件不清理**：删除项目 / 重置图标时只删配置引用，不删已复制到全局目录的图标文件。`IconManager.deleteIcon` 已实现却从未被调用，长期使用会堆积孤儿文件。 | `src/handlers/commandHandlers.ts`、`src/utils/iconManager.ts` | 删除/重置时调用 `deleteIcon`；注意同一图标可能被多个项目共享，需先做引用计数判断。 |
| B3 | 🟡 | **点击树项默认「新窗口」打开**：默认点击触发 `handleOpenProject`，但它用 `forceNewWindow=true`，与「当前窗口」这一更常见直觉不符，且和右键「在当前窗口打开」重复。 | `src/handlers/commandHandlers.ts:99-100` | 见「待决策事项 D1」。 |
| B4 | 🟢 | **路径比较未处理 Windows 大小写 / 分隔符差异**：`__isProjectAlreadyOpen` 仅 `path.normalize`，盘符大小写、尾斜杠、`/` vs `\` 可能误判。 | `src/handlers/commandHandlers.ts:42-56` | 增加 `path.resolve` + 小写化（Windows）后比较。 |
| B5 | 🟢 | **`id` 生成有碰撞风险**：`new Date().getTime().toString(36)`，同一毫秒添加两个项目会撞 id。 | `src/handlers/commandHandlers.ts`（两处 push） | 改用 `crypto.randomUUID()` 或加随机后缀。 |
| B6 | 🟢 | **无重复项目检测**：同一文件夹可被添加为多个项目，无任何去重提示。 | `src/handlers/commandHandlers.ts` | 添加时检查 `path` 是否已存在并提示。 |
| B7 | 🟢 | **文件监视器只监听 `project-manager.json`**：手动编辑 `folder-config.json` 不会触发树刷新。 | `src/utils/fileWatcher.ts` | 同时 watch 两个配置文件（或 watch 目录）。 |
| B8 | 🟢 | **资源清理不完整**：`common.ts` 的 `outputChannel` 惰性创建后从不 dispose；`deactivate` 中 `fileWatcher.dispose()` 与 `context.subscriptions` 里的 watcher 存在双重 dispose（幂等但冗余）。 | `src/utils/common.ts`、`src/extension.ts:165-170` | 统一清理逻辑，`outputChannel` 纳入订阅。 |

### C. 代码质量 / 维护性

| # | 严重度 | 问题 | 位置 | 建议 |
|---|---|---|---|---|
| C1 | 🟢 | 命令注册为手写数组 + 大量 `.bind()`，冗余。 | `src/extension.ts:66-163` | 用对象/Map 收敛，或保留但精简。 |
| C2 | 🟢 | `handleAddProject` 与 `handleSaveCurrentFolderAsProject` 大量重复（选文件夹、选图标、push）。 | `src/handlers/commandHandlers.ts` | 抽取公共流程函数。 |
| C3 | 🟢 | 三个 `handleOpenProject*` 重复路径校验逻辑。 | `src/handlers/commandHandlers.ts` | 抽取 `__openProject(uri, mode)`。 |
| C4 | 🟢 | **无任何单元测试**（devDeps 有 mocha 但无测试文件）。 | — | 为 `common.ts` 纯函数补测试。 |
| C5 | 🟢 | **类型定义文件用 `.d.ts`** 承载普通 interface，违反惯例。 | `src/types/project.d.ts` | 改为 `project.ts`。 |
| C6 | 🟢 | 包管理器混用（pnpm / yarn / npm）。 | `package.json`、`.yarnrc`、`.gitignore` | 统一（建议 pnpm），提交 lock 文件。 |

---

## 三、功能与 UX 改进

> 这些是「用户能感知到的区别」。按价值从高到低排列，供讨论取舍。

1. **空状态引导（viewsWelcome）** — 没有项目时侧边栏空白，可用 `viewsWelcome` 贡献点展示引导文案 + 快捷按钮（「添加项目」「保存当前文件夹」）。**用户感知：新用户一眼知道怎么开始。**

2. **项目搜索 / 过滤** — 项目多了之后无法快速定位。**用户感知：几十上百个项目时能秒找。**

3. **失效项目的可见提示** — 路径失效的项目目前在点击时才报错。可改为树中置灰/标红 + 悬浮提示。**用户感知：坏掉的项目一眼可见，不用点开才被弹窗打断。**

4. **排序方式可选** — 目前固定按名称升序。可支持最近使用、手动拖拽排序、收藏置顶。**用户感知：常用项目更容易触达。**

5. **悬浮 tooltip 显示完整路径 / 图标 / 所属文件夹**。**用户感知：信息更全。**

6. **常用命令快捷键**（添加项目、快速切换）。**用户感知：少动鼠标。**

7. **批量操作**（多选删除 / 移动；当前 DnD 也只处理首个）。**用户感知：整理大量项目更快。**

8. **新手引导改造** — 目前首次激活直接弹 webview，可能打断用户。可改为 viewsWelcome 或欢迎按钮触发，或让「跳过」更明显。**用户感知：不被打断。**

9. **更丰富的配置项** — 「默认打开窗口方式」「是否显示路径」「图标显示」等已有，可补「树视图紧凑模式」等。**用户感知：更可控。**

---

## 四、迭代计划

分阶段推进，每个「修复节点」单独 commit。

- **Phase 0 — 基线与环境（1 commit）**
  升级 `engines.vscode` / `@types/vscode` → `^1.136.0`；移除 `activationEvents`；补 `capabilities`；统一包管理器并提交 lock 文件。

- **Phase 1 — 安全与规范（1 commit）**
  Webview 补 CSP，抽离内联脚本/样式（A1）。

- **Phase 2 — Bug 修复（按主题拆分 commit）**
  - 2a：配置默认值统一（B1）+ 路径比较（B4）+ id 生成（B5）
  - 2b：孤儿图标清理（B2）+ 重复项目检测（B6）
  - 2c：文件监视器补 folder-config（B7）+ 资源清理（B8）

- **Phase 3 — 功能完善（每个功能一个 commit，先讨论后实现）**
  空状态 viewsWelcome → 失效项目提示 → 搜索/排序 → tooltip → 快捷键。

- **Phase 4 — 体验打磨（可选，再讨论）**
  批量操作、收藏置顶、新手引导改造。

---

## 五、待决策事项

以下是需要你拍板的问题，直接影响实现方向：

- **D1（默认打开方式）**：点击树项默认在「当前窗口」还是「新窗口」打开？（影响 B3 的改法）
- **D2（版本目标）**：`engines.vscode` 升到最新的 `1.136`，还是保守选一个更早的版本以兼容更多用户？
- **D3（迭代范围）**：本轮是否只做 Phase 0–2（安全 + bug），功能改进（Phase 3）单独排期？还是把某个高频功能（如空状态引导）一并做掉？
- **D4（配置默认值方向）**：`showProjectPath` 默认改为 `true`（显示路径）还是保持 `false`？
