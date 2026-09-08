import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { ProjectItem, FolderItem, TreeItem } from "../types/project";
import {
  saveProjects,
  loadProjects,
  commonSelectFolder,
  updateFolderConfig,
  getFolderConfig,
  renameFolderConfig,
  deleteFolderConfig,
  normalizePathForCompare,
  generateProjectId,
  deleteIconIfUnused,
} from "../utils/common";
import { IconManager, ICON_FILE_FILTERS } from "../utils/iconManager";

/**
 * 可刷新的树数据提供器接口
 */
interface RefreshableTreeDataProvider<T> extends vscode.TreeDataProvider<T> {
  refresh(): void;
}

/**
 * 命令处理器
 */
export class CommandHandlers {
  private iconManager: IconManager;

  constructor(
    private context: vscode.ExtensionContext,
    private configFile: string,
    private treeProvider: RefreshableTreeDataProvider<TreeItem>
  ) {
    this.iconManager = new IconManager(context);
  }

  /**
   * 检查项目是否已经在当前窗口打开
   * @param projectPath 项目路径
   * @returns 是否已打开
   */
  private __isProjectAlreadyOpen(projectPath: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    // 标准化路径以进行比较（Windows 下忽略大小写）
    const normalizedProjectPath = normalizePathForCompare(projectPath);

    // 检查当前打开的工作区文件夹是否与项目路径相同
    return workspaceFolders.some((folder) => {
      return (
        normalizePathForCompare(folder.uri.fsPath) === normalizedProjectPath
      );
    });
  }

  /**
   * 检查项目路径是否存在
   * @param projectPath 项目路径
   * @returns 是否存在
   */
  private __isProjectPathValid(projectPath: string): boolean {
    try {
      return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 刷新树视图
   */
  private __refreshTree(): void {
    this.treeProvider.refresh();
  }

  /**
   * * 打开项目
   */
  async handleOpenProject(item: ProjectItem): Promise<void> {
    // 检查项目路径是否有效
    if (!this.__isProjectPathValid(item.path)) {
      const action = await vscode.window.showErrorMessage(
        `项目路径不存在：${item.path}`,
        "从列表中移除"
      );
      if (action === "从列表中移除") {
        await this.handleDeleteProject(item);
      }
      return;
    }

    if (this.__isProjectAlreadyOpen(item.path)) {
      vscode.window.showInformationMessage(`已经打开项目：${item.name}`);
      return;
    }

    const uri = vscode.Uri.file(item.path);
    await vscode.commands.executeCommand("vscode.openFolder", uri, true);
  }

  /**
   * * 在当前窗口打开项目
   */
  async handleOpenProjectInCurrentWindow(item: ProjectItem): Promise<void> {
    // 检查项目路径是否有效
    if (!this.__isProjectPathValid(item.path)) {
      const action = await vscode.window.showErrorMessage(
        `项目路径不存在：${item.path}`,
        "从列表中移除"
      );
      if (action === "从列表中移除") {
        await this.handleDeleteProject(item);
      }
      return;
    }

    if (this.__isProjectAlreadyOpen(item.path)) {
      vscode.window.showInformationMessage(`已经打开项目：${item.name}`);
      return;
    }

    const uri = vscode.Uri.file(item.path);
    await vscode.commands.executeCommand("vscode.openFolder", uri, false);
  }

  /**
   * * 在新窗口打开项目
   */
  async handleOpenProjectInNewWindow(item: ProjectItem): Promise<void> {
    // 检查项目路径是否有效
    if (!this.__isProjectPathValid(item.path)) {
      const action = await vscode.window.showErrorMessage(
        `项目路径不存在：${item.path}`,
        "从列表中移除"
      );
      if (action === "从列表中移除") {
        await this.handleDeleteProject(item);
      }
      return;
    }

    if (this.__isProjectAlreadyOpen(item.path)) {
      vscode.window.showWarningMessage(
        `已经打开项目：${item.name}，由于VSCode设计问题，无法在新窗口再次打开`
      );
      return;
    }

    const uri = vscode.Uri.file(item.path);
    await vscode.commands.executeCommand("vscode.openFolder", uri, true);
  }

  /**
   * * 重命名项目
   */
  async handleRenameProject(item: ProjectItem): Promise<void> {
    const projects = loadProjects(this.configFile);
    const idx = projects.findIndex((p) => p.id === item.id);
    if (idx === -1) {
      return;
    }

    const newName = await vscode.window.showInputBox({
      prompt: "输入新的项目名称",
      value: item.name,
    });

    if (newName && newName.trim() && newName !== item.name) {
      projects[idx].name = newName.trim();
      saveProjects(projects, this.configFile);
      this.__refreshTree();
    }
  }

  /**
   * * 添加新项目
   */
  async handleAddProject(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "输入项目名称",
    });

    if (!name || !name.trim()) {
      return;
    }

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "选择项目文件夹",
    });

    if (!folderUri || folderUri.length === 0) {
      return;
    }

    // 检查是否已存在相同路径的项目
    if (
      loadProjects(this.configFile).some(
        (p) =>
          normalizePathForCompare(p.path) ===
          normalizePathForCompare(folderUri[0].fsPath)
      )
    ) {
      vscode.window.showWarningMessage("该文件夹已作为项目存在，请勿重复添加");
      return;
    }

    // 询问是否添加到文件夹
    const addToFolder = await vscode.window.showQuickPick(["是", "否"], {
      placeHolder: "是否将项目添加到文件夹？",
      canPickMany: false,
    });

    let folderName: string | undefined = undefined;
    if (addToFolder === "是") {
      const res = await commonSelectFolder(
        this.configFile,
        "请选择要添加到的文件夹"
      );
      // 用户取消选择则终止添加流程
      if (res.cancelled) {
        return;
      }
      folderName = res.folderName;
    }

    // 询问是否设置图标
    const setIcon = await vscode.window.showQuickPick(["是", "否"], {
      placeHolder: "是否设置项目图标？",
      canPickMany: false,
    });

    let iconName = "";

    if (setIcon === "是") {
      const iconUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: ICON_FILE_FILTERS,
        openLabel: "选择项目图标",
      });

      if (iconUri && iconUri.length > 0) {
        iconName = this.iconManager.copyIconToGlobal(
          iconUri[0].fsPath,
          this.configFile
        );
      }
    }

    const projects = loadProjects(this.configFile);
    projects.push({
      id: generateProjectId(),
      name: name.trim(),
      path: folderUri[0].fsPath,
      icon: iconName || undefined,
      folder: folderName || undefined,
    });

    saveProjects(projects, this.configFile);
    this.__refreshTree();
  }

  /**
   * * 移动项目到文件夹
   */
  async handleMoveProjectToFolder(item: ProjectItem): Promise<void> {
    const projects = loadProjects(this.configFile);
    const res = await commonSelectFolder(
      this.configFile,
      "请选择要移动到的文件夹"
    );

    // 用户取消选择或输入则不做任何修改
    if (res.cancelled) {
      return;
    }

    const folderName = res.folderName;

    // 获取这个元素的坐标
    const idx = projects.findIndex((p) => p.id === item.id);
    if (idx !== -1) {
      if (folderName !== undefined) {
        projects[idx].folder = folderName;
      } else {
        // 移动到根目录：删除 folder 字段
        delete projects[idx].folder;
      }

      // 统一进行保存更新
      saveProjects(projects, this.configFile);
      this.__refreshTree();
    }
  }

  /**
   * * 重命名文件夹
   */
  async handleRenameFolder(item: FolderItem): Promise<void> {
    const newName = await vscode.window.showInputBox({
      prompt: "输入新的文件夹名称",
      value: item.name,
    });

    if (newName && newName.trim() && newName !== item.name) {
      const projects = loadProjects(this.configFile);

      // 更新所有在该文件夹中的项目
      projects.forEach((project) => {
        if (project.folder === item.name) {
          project.folder = newName.trim();
        }
      });

      // 同时更新文件夹配置中的名称
      renameFolderConfig(item.name, newName.trim(), this.configFile);

      saveProjects(projects, this.configFile);
      this.__refreshTree();
    }
  }

  /**
   * * 删除文件夹
   */
  async handleDeleteFolder(item: FolderItem): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `确定要删除文件夹 "${item.name}" 吗？文件夹中的项目将移动到根目录。`,
      { modal: true },
      "删除"
    );

    if (confirm === "删除") {
      const projects = loadProjects(this.configFile);
      const iconName = getFolderConfig(item.name, this.configFile)?.icon;

      // 移除所有项目的文件夹属性
      projects.forEach((project) => {
        if (project.folder === item.name) {
          delete project.folder;
        }
      });

      // 同时删除文件夹配置
      deleteFolderConfig(item.name, this.configFile);

      saveProjects(projects, this.configFile);
      deleteIconIfUnused(iconName, this.configFile);
      this.__refreshTree();
    }
  }

  /**
   * * 修改文件夹图标
   */
  async handleChangeFolderIcon(item: FolderItem): Promise<void> {
    const iconUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: ICON_FILE_FILTERS,
      openLabel: "选择新的文件夹图标",
    });

    if (!iconUri || iconUri.length === 0) {
      return;
    }

    const iconName = this.iconManager.copyIconToGlobal(
      iconUri[0].fsPath,
      this.configFile
    );

    const oldIconName = getFolderConfig(item.name, this.configFile)?.icon;

    // 更新文件夹配置
    updateFolderConfig(
      {
        name: item.name,
        icon: iconName,
      },
      this.configFile
    );

    deleteIconIfUnused(oldIconName, this.configFile);
    this.__refreshTree();
    vscode.window.showInformationMessage(`已更新文件夹 "${item.name}" 的图标`);
  }

  /**
   * * 重置文件夹图标
   */
  async handleRemoveFolderIcon(item: FolderItem): Promise<void> {
    // 获取当前文件夹配置
    const folderConfig = getFolderConfig(item.name, this.configFile);
    
    if (!folderConfig || !folderConfig.icon) {
      vscode.window.showInformationMessage(`文件夹 "${item.name}" 没有自定义图标`);
      return;
    }

    const iconName = folderConfig.icon;
    // 更新文件夹配置，移除图标
    updateFolderConfig(
      {
        name: item.name,
        icon: undefined,
      },
      this.configFile
    );

    deleteIconIfUnused(iconName, this.configFile);
    this.__refreshTree();
    vscode.window.showInformationMessage(`已重置文件夹 "${item.name}" 的图标`);
  }

  /**
   * * 从文件夹中移除项目（移动到根目录）
   */
  async handleRemoveFromFolder(item: ProjectItem): Promise<void> {
    if (!item.folder) {
      vscode.window.showInformationMessage(`项目 "${item.name}" 已在根目录`);
      return;
    }

    const projects = loadProjects(this.configFile);
    const idx = projects.findIndex((p) => p.id === item.id);
    
    if (idx === -1) {
      return;
    }

    // 移除文件夹属性，将项目移动到根目录
    delete projects[idx].folder;
    
    saveProjects(projects, this.configFile);
    this.__refreshTree();
    vscode.window.showInformationMessage(`已将项目 "${item.name}" 移动到根目录`);
  }

  /**
   * * 删除项目
   */
  async handleDeleteProject(item: ProjectItem): Promise<void> {
    const projects = loadProjects(this.configFile);
    const idx = projects.findIndex((p) => p.id === item.id);
    if (idx === -1) {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `确定要删除项目 "${item.name}" 吗？`,
      { modal: true },
      "删除"
    );

    if (confirm === "删除") {
      const iconName = projects[idx].icon;
      projects.splice(idx, 1);
      saveProjects(projects, this.configFile);
      deleteIconIfUnused(iconName, this.configFile);
      this.__refreshTree();
    }
  }

  /**
   * * 修改项目图标
   */
  async handleChangeIcon(item: ProjectItem): Promise<void> {
    const iconUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: ICON_FILE_FILTERS,
      openLabel: "选择新的项目图标",
    });

    if (!iconUri || iconUri.length === 0) {
      return;
    }

    const iconName = this.iconManager.copyIconToGlobal(
      iconUri[0].fsPath,
      this.configFile
    );
    const projects = loadProjects(this.configFile);
    const idx = projects.findIndex((p) => p.id === item.id);

    if (idx === -1) {
      return;
    }

    const oldIconName = projects[idx].icon;
    projects[idx].icon = iconName;
    saveProjects(projects, this.configFile);
    deleteIconIfUnused(oldIconName, this.configFile);
    this.__refreshTree();
  }

  /**
   * * 重置项目图标
   */
  async handleRemoveProjectIcon(item: ProjectItem): Promise<void> {
    // 获取所有的项目
    const projects = loadProjects(this.configFile);
    const idx = projects.findIndex((p) => p.id === item.id);
    if (idx === -1) {
      return;
    }

    const iconName = projects[idx].icon;
    // 直接移除项目的图标即可
    delete projects[idx].icon;

    // 通用保存操作
    saveProjects(projects, this.configFile);
    deleteIconIfUnused(iconName, this.configFile);
    this.__refreshTree();
    vscode.window.showInformationMessage(`已重置项目 "${item.name}" 的图标`);
  }

  /**
   * * 保存当前文件夹为项目
   */
  async handleSaveCurrentFolderAsProject(): Promise<void> {
    // 获取当前打开的文件夹
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("没有打开的文件夹");
      return;
    }

    const currentFolderPath = workspaceFolders[0].uri.fsPath;
    const folderName = path.basename(currentFolderPath);

    // 检查是否已存在相同路径的项目
    if (
      loadProjects(this.configFile).some(
        (p) =>
          normalizePathForCompare(p.path) ===
          normalizePathForCompare(currentFolderPath)
      )
    ) {
      vscode.window.showWarningMessage("当前文件夹已作为项目存在，请勿重复添加");
      return;
    }

    // 询问项目名称，默认使用文件夹名称
    const name = await vscode.window.showInputBox({
      prompt: "输入项目名称",
      value: folderName,
    });

    if (!name || !name.trim()) {
      return;
    }

    // 询问是否添加到文件夹
    const addToFolder = await vscode.window.showQuickPick(["是", "否"], {
      placeHolder: "是否将项目添加到文件夹？",
      canPickMany: false,
    });

    let folderNameValue: string | undefined = undefined;
    if (addToFolder === "是") {
      const res = await commonSelectFolder(
        this.configFile,
        "请选择文件夹或创建新文件夹"
      );
      // 用户取消则终止保存流程
      if (res.cancelled) {
        return;
      }
      folderNameValue = res.folderName;
    }

    // 询问是否设置图标
    const setIcon = await vscode.window.showQuickPick(["是", "否"], {
      placeHolder: "是否设置项目图标？",
      canPickMany: false,
    });

    let iconName = "";

    if (setIcon === "是") {
      const iconUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: ICON_FILE_FILTERS,
        openLabel: "选择项目图标",
      });

      if (iconUri && iconUri.length > 0) {
        iconName = this.iconManager.copyIconToGlobal(
          iconUri[0].fsPath,
          this.configFile
        );
      }
    }

    const projects = loadProjects(this.configFile);
    projects.push({
      id: generateProjectId(),
      name: name.trim(),
      path: currentFolderPath,
      icon: iconName || undefined,
      folder: folderNameValue || undefined,
    });

    saveProjects(projects, this.configFile);
    this.__refreshTree();
  }

  /**
   * * 编辑配置文件
   */
  async handleEditConfig(): Promise<void> {
    try {
      // 确保配置文件存在
      if (!fs.existsSync(this.configFile)) {
        const dir = path.dirname(this.configFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.configFile, "[]", "utf8");
      }

      // 打开配置文件进行编辑
      const configUri = vscode.Uri.file(this.configFile);
      await vscode.window.showTextDocument(configUri);

      vscode.window.showInformationMessage(
        "配置文件已打开，编辑完成后保存即可生效"
      );
    } catch (error) {
      vscode.window.showErrorMessage(`打开配置文件失败: ${error}`);
    }
  }
}
