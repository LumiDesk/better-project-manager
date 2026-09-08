import type { ProjectItem, FolderConfig, ConfigData } from "../types/project";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { randomUUID } from "crypto";

/**
 * 日志输出通道
 */
let outputChannel: vscode.OutputChannel | undefined;

/**
 * 获取日志输出通道
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Better Project Manager");
  }
  return outputChannel;
}

/**
 * 记录日志
 * @param message 日志消息
 * @param level 日志级别
 */
export function log(
  message: string,
  level: "info" | "warn" | "error" = "info"
): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  getOutputChannel().appendLine(formattedMessage);
  
  if (level === "error") {
    console.error(formattedMessage);
  } else if (level === "warn") {
    console.warn(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
}

/**
 * 释放日志输出通道
 */
export function disposeOutputChannel(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
}

/**
 * 标准化路径用于比较
 * @description Windows 下忽略大小写，并解析相对路径与尾斜杠差异
 * @param p 待标准化路径
 * @returns 标准化后的路径
 */
export const normalizePathForCompare = (p: string): string => {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

/**
 * 生成唯一的项目 id
 * @returns 随机 UUID
 */
export const generateProjectId = (): string => randomUUID();

/**
 * 检查路径是否为存在的目录
 * @param p 待检查路径
 * @returns 是否为存在的目录
 */
export const isDirectory = (p: string): boolean => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * 验证项目数据结构
 * @param data 待验证的数据
 * @returns 是否为有效的项目数组
 */
function isValidProjectArray(data: unknown): data is ProjectItem[] {
  if (!Array.isArray(data)) {
    return false;
  }
  
  return data.every((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.path === "string" &&
      (item.icon === undefined || typeof item.icon === "string") &&
      (item.folder === undefined || typeof item.folder === "string")
    );
  });
}

/**
 * 验证文件夹配置数据结构
 * @param data 待验证的数据
 * @returns 是否为有效的文件夹配置数组
 */
function isValidFolderConfigArray(data: unknown): data is FolderConfig[] {
  if (!Array.isArray(data)) {
    return false;
  }
  
  return data.every((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.name === "string" &&
      (item.icon === undefined || typeof item.icon === "string")
    );
  });
}

/**
 * 获取文件夹配置文件路径
 * @param configFile 项目配置文件路径
 * @returns 文件夹配置文件路径
 */
function getFolderConfigFile(configFile: string): string {
  const dir = path.dirname(configFile);
  return path.join(dir, "folder-config.json");
}

/**
 * 保存项目列表到配置文件
 * @param projects 项目列表
 * @param configFile 配置文件路径
 * @throws 如果保存失败则抛出错误
 */
export const saveProjects = (
  projects: ProjectItem[],
  configFile: string
): void => {
  try {
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(projects, null, 2), "utf8");
    log(`成功保存 ${projects.length} 个项目到配置文件`);
  } catch (error) {
    const errorMessage = `保存项目列表失败: ${error}`;
    log(errorMessage, "error");
    vscode.window.showErrorMessage(errorMessage);
    throw error;
  }
};

/**
 * 从配置文件加载项目列表
 * @param configFile 配置文件路径
 * @returns 项目列表
 */
export const loadProjects = (configFile: string): ProjectItem[] => {
  try {
    if (!fs.existsSync(configFile)) {
      log("配置文件不存在，返回空列表");
      return [];
    }
    
    const raw = fs.readFileSync(configFile, "utf8");
    const data: unknown = JSON.parse(raw);
    
    if (!isValidProjectArray(data)) {
      log("配置文件格式无效，返回空列表", "warn");
      return [];
    }
    
    log(`成功加载 ${data.length} 个项目`);
    return data;
  } catch (error) {
    log(`加载项目列表失败: ${error}`, "error");
    return [];
  }
};

/**
 * 保存文件夹配置到配置文件
 * @param folders 文件夹配置列表
 * @param configFile 项目配置文件路径
 */
export const saveFolderConfigs = (
  folders: FolderConfig[],
  configFile: string
): void => {
  try {
    const folderConfigFile = getFolderConfigFile(configFile);
    const dir = path.dirname(folderConfigFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(folderConfigFile, JSON.stringify(folders, null, 2), "utf8");
    log(`成功保存 ${folders.length} 个文件夹配置`);
  } catch (error) {
    const errorMessage = `保存文件夹配置失败: ${error}`;
    log(errorMessage, "error");
    vscode.window.showErrorMessage(errorMessage);
    throw error;
  }
};

/**
 * 从配置文件加载文件夹配置
 * @param configFile 项目配置文件路径
 * @returns 文件夹配置列表
 */
export const loadFolderConfigs = (configFile: string): FolderConfig[] => {
  try {
    const folderConfigFile = getFolderConfigFile(configFile);
    if (!fs.existsSync(folderConfigFile)) {
      log("文件夹配置文件不存在，返回空列表");
      return [];
    }
    
    const raw = fs.readFileSync(folderConfigFile, "utf8");
    const data: unknown = JSON.parse(raw);
    
    if (!isValidFolderConfigArray(data)) {
      log("文件夹配置文件格式无效，返回空列表", "warn");
      return [];
    }
    
    log(`成功加载 ${data.length} 个文件夹配置`);
    return data;
  } catch (error) {
    log(`加载文件夹配置失败: ${error}`, "error");
    return [];
  }
};

/**
 * 获取文件夹配置
 * @param folderName 文件夹名称
 * @param configFile 项目配置文件路径
 * @returns 文件夹配置，如果不存在则返回 undefined
 */
export const getFolderConfig = (
  folderName: string,
  configFile: string
): FolderConfig | undefined => {
  const folders = loadFolderConfigs(configFile);
  return folders.find((f) => f.name === folderName);
};

/**
 * 更新或创建文件夹配置
 * @param folderConfig 文件夹配置
 * @param configFile 项目配置文件路径
 */
export const updateFolderConfig = (
  folderConfig: FolderConfig,
  configFile: string
): void => {
  const folders = loadFolderConfigs(configFile);
  const idx = folders.findIndex((f) => f.name === folderConfig.name);
  
  if (idx !== -1) {
    folders[idx] = folderConfig;
  } else {
    folders.push(folderConfig);
  }
  
  saveFolderConfigs(folders, configFile);
};

/**
 * 重命名文件夹配置
 * @param oldName 旧名称
 * @param newName 新名称
 * @param configFile 项目配置文件路径
 */
export const renameFolderConfig = (
  oldName: string,
  newName: string,
  configFile: string
): void => {
  const folders = loadFolderConfigs(configFile);
  const idx = folders.findIndex((f) => f.name === oldName);
  
  if (idx !== -1) {
    folders[idx].name = newName;
    saveFolderConfigs(folders, configFile);
  }
};

/**
 * 删除文件夹配置
 * @param folderName 文件夹名称
 * @param configFile 项目配置文件路径
 */
export const deleteFolderConfig = (
  folderName: string,
  configFile: string
): void => {
  const folders = loadFolderConfigs(configFile);
  const filtered = folders.filter((f) => f.name !== folderName);
  
  if (filtered.length !== folders.length) {
    saveFolderConfigs(filtered, configFile);
  }
};

/**
 * 获取已经存在的项目
 * @param configFile 配置文件目录
 * @returns
 */
export const getFolderList = (configFile: string) => {
  const projects = loadProjects(configFile);
  const folderSet = new Set<string>();

  projects.forEach((project) => {
    if (project.folder) {
      folderSet.add(project.folder);
    }
  });
  return Array.from(folderSet);
};

/**
 * 通用的选择文件夹方法
 * @description 允许选择新文件夹, 或者已经存在的文件夹; 如果选择新文件夹, 则自动获取输入
 * @param configFile 配置文件路径 会自动进行读取
 * @param message 配置信息内容
 * @returns 选择的文件夹的名称, 如果是根目录则为undefined 否则为对应文件夹的名称
 */
export const commonSelectFolder = async (
  configFile: string,
  message: string
): Promise<{ folderName: string | undefined; cancelled: boolean }> => {
  const folderList = getFolderList(configFile);
  const selectedFolder = await vscode.window.showQuickPick(
    ["新建文件夹", ...folderList, "根目录"],
    {
      placeHolder: message,
      canPickMany: false,
    }
  );

  // 用户取消了选择
  if (!selectedFolder) {
    return { folderName: undefined, cancelled: true };
  }

  if (selectedFolder === "新建文件夹") {
    const name = await vscode.window.showInputBox({
      prompt: "输入新文件夹名称",
    });
    // 取消输入或未填写则视为取消整个操作
    if (!name || !name.trim()) {
      return { folderName: undefined, cancelled: true };
    }
    return { folderName: name.trim(), cancelled: false };
  }

  if (selectedFolder === "根目录") {
    return { folderName: undefined, cancelled: false };
  }

  return { folderName: selectedFolder, cancelled: false };
};

/**
 * 删除未被任何项目或文件夹引用的图标文件
 * @param iconName 图标文件名
 * @param configFile 项目配置文件路径
 */
export const deleteIconIfUnused = (
  iconName: string | undefined,
  configFile: string
): void => {
  if (!iconName) {
    return;
  }

  // 仍被某个项目引用则不删除
  if (loadProjects(configFile).some((p) => p.icon === iconName)) {
    return;
  }

  // 仍被某个文件夹引用则不删除
  if (loadFolderConfigs(configFile).some((f) => f.icon === iconName)) {
    return;
  }

  // 无任何引用，删除图标文件
  const iconPath = path.join(path.dirname(configFile), iconName);
  try {
    if (fs.existsSync(iconPath)) {
      fs.unlinkSync(iconPath);
      log(`已删除未使用的图标文件: ${iconName}`);
    }
  } catch (error) {
    log(`删除图标文件失败: ${error}`, "warn");
  }
};
