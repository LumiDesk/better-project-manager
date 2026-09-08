import * as vscode from "vscode";
import * as path from "path";

import { CommandHandlers } from "./handlers";
import { ProjectTreeProvider } from "./providers";
import { ProjectTreeDragAndDropController } from "./providers/ProjectTreeDragAndDropController";

import { OnboardingPanel } from "./webview/OnboardingPanel";
import { FileWatcher } from "./utils/fileWatcher";
import { disposeOutputChannel } from "./utils/common";

// 激活
export function activate(context: vscode.ExtensionContext) {
  // 首次安装弹窗交互式引导
  if (!context.globalState.get("onboarding_shown")) {
    // 使用回调方式处理引导完成事件，避免覆盖原型方法
    OnboardingPanel.show(context.extensionUri, () => {
      context.globalState.update("onboarding_shown", true);
    });
  }

  // 修改配置文件路径为 VSCode 全局存储目录
  const configFile = path.join(
    context.globalStorageUri.fsPath,
    "project-manager.json"
  );

  // 初始化树提供器
  const treeProvider = new ProjectTreeProvider(context, configFile);
  const dragAndDropController = new ProjectTreeDragAndDropController(
    configFile,
    () => treeProvider.refresh()
  );
  const treeView = vscode.window.createTreeView("betterProjectManagerSidebar", {
    treeDataProvider: treeProvider,
    dragAndDropController,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView, dragAndDropController);

  // 初始化命令处理器
  const commandHandlers = new CommandHandlers(
    context,
    configFile,
    treeProvider
  );

  // 初始化文件监视器（纳入订阅，随扩展销毁自动清理）
  const fileWatcher = new FileWatcher();
  fileWatcher.createConfigWatcher(configFile, () => {
    treeProvider?.refresh();
  });
  context.subscriptions.push(fileWatcher);

  // 统一注册命令
  registerCommands(context, commandHandlers);
}

/**
 * NOTE 注册所有命令
 */
function registerCommands(
  context: vscode.ExtensionContext,
  handlers: CommandHandlers
): void {
  const commands = [
    {
      // NOTE 打开项目
      command: "project-manager.openProject",
      handler: handlers.handleOpenProject.bind(handlers),
    },
    {
      // NOTE 在当前窗口打开项目
      command: "project-manager.openProjectInCurrentWindow",
      handler: handlers.handleOpenProjectInCurrentWindow.bind(handlers),
    },
    {
      // NOTE 在新窗口打开项目
      command: "project-manager.openProjectInNewWindow",
      handler: handlers.handleOpenProjectInNewWindow.bind(handlers),
    },
    {
      // NOTE 重命名项目
      command: "project-manager.renameProject",
      handler: handlers.handleRenameProject.bind(handlers),
    },
    {
      // NOTE 添加新的项目
      command: "project-manager.addProject",
      handler: handlers.handleAddProject.bind(handlers),
    },
    {
      // NOTE 删除项目
      command: "project-manager.deleteProject",
      handler: handlers.handleDeleteProject.bind(handlers),
    },
    {
      // NOTE 修改项目图标
      command: "project-manager.changeIcon",
      handler: handlers.handleChangeIcon.bind(handlers),
    },
    // NOTE 移除项目图标
    {
      command: "project-manager.removeProjectIcon",
      handler: handlers.handleRemoveProjectIcon.bind(handlers),
    },
    {
      // NOTE 修改配置文件
      command: "project-manager.editConfig",
      handler: handlers.handleEditConfig.bind(handlers),
    },
    {
      // NOTE 移动项目到文件夹
      command: "project-manager.moveProjectToFolder",
      handler: handlers.handleMoveProjectToFolder.bind(handlers),
    },
    {
      // NOTE 重命名文件夹
      command: "project-manager.renameFolder",
      handler: handlers.handleRenameFolder.bind(handlers),
    },
    {
      // NOTE 删除文件夹
      command: "project-manager.deleteFolder",
      handler: handlers.handleDeleteFolder.bind(handlers),
    },
    {
      // NOTE 修改文件夹图标
      command: "project-manager.changeFolderIcon",
      handler: handlers.handleChangeFolderIcon.bind(handlers),
    },
    {
      // NOTE 重置文件夹图标
      command: "project-manager.removeFolderIcon",
      handler: handlers.handleRemoveFolderIcon.bind(handlers),
    },
    {
      // NOTE 保存当前文件夹作为新的项目
      command: "project-manager.saveCurrentFolderAsProject",
      handler: handlers.handleSaveCurrentFolderAsProject.bind(handlers),
    },
    {
      // NOTE 从文件夹中移除项目
      command: "project-manager.removeFromFolder",
      handler: handlers.handleRemoveFromFolder.bind(handlers),
    },
    {
      // NOTE 唤起新手引导
      command: "project-manager.showOnboarding",
      handler: () => OnboardingPanel.show(context.extensionUri),
    },
  ];

  commands.forEach(({ command, handler }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, handler)
    );
  });
}

export function deactivate() {
  // 释放日志输出通道
  disposeOutputChannel();
}
